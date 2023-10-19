import { Tx, Script, Address, isData, UTxO, DataB, DataI, Value, pBSToData, pByteString, pIntToData, Hash28 } from "@harmoniclabs/plu-ts";
import { script, scriptMainnetAddr, beneficiary, beneficiaryWithStake } from "../contracts/stakeContract";
import { cli } from "../utils/cli";
import VestingDatum from "../VestingDatum";

export async function mintTx(addr: string, index: number) {

  const userAddrs = [Address.fromString(addr)];

  userAddrs.map(addr => {
    console.log('used addrs: ', addr.paymentCreds.hash.toString());
  })

  let userAddr!: Address;

  console.log('beneficiary: ', beneficiary.paymentCreds.hash.toString());

  const utxosToSpend = (await cli.query.utxo({ address: scriptMainnetAddr }))
    .filter((utxo: UTxO) => {
      const datum = utxo.resolved.datum;
      const value = utxo.resolved.value.lovelaces;

      if (
        // datum is inline
        isData(datum)
      ) {
        const pkh = datum.toJson();

        // search if it corresponds to one of my public keys
        const myPkhIdx = userAddrs.findIndex(
          addr => {
            if (pkh.fields[0] && pkh.fields[1] && pkh.fields[2]) {
              return pkh.fields[0].bytes.toString() == addr.paymentCreds.hash.toString()
                && pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
                && pkh.fields[2].int == 0n
                && value > 2_000_000
            }
            return false;
          }
        );

        // not a pkh of mine; not an utxo I can unstake
        if (myPkhIdx < 0) return false;

        // else found my staked utxo
        userAddr = userAddrs[myPkhIdx];

        return true;
      }

      return false;
    });

  if (utxosToSpend.length == 0) {
    throw "uopsie, are you sure your tx had enough time to get to the blockchain?"
  }

  console.log(utxosToSpend);

  const paymentPrivateKey = cli.utils.readPrivateKey("/tokens/payment.skey");
  const policyPrivateKey = cli.utils.readPrivateKey("/tokens/policy/policy.skey");

  const beneficiaryWithStakeUTxO = (await cli.query.utxo({ address: beneficiaryWithStake })).find(u => u.resolved.value.lovelaces > 1_000_000);

  const mintAmount = utxosToSpend[index].resolved.value.lovelaces - 2_000_000n;

  const policy = new Hash28("bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4");

  let tx = await cli.transaction.build({
    inputs: [
      {
        utxo: utxosToSpend[index],
        inputScript: {
          script: script,
          datum: "inline",
          redeemer: new DataI(0)
        }
      }
    ],
    outputs: [
      {
        address: userAddr,
        value: new Value([
          {
            policy: "",
            assets: { "": BigInt(2_000_000n) },
          },
          {
            policy,
            assets: { "stADA": BigInt(mintAmount) },
          }
        ]),
      },
      {
        address: scriptMainnetAddr,
        value: Value.lovelaces(mintAmount),
        datum: VestingDatum.VestingDatum({
          user: pBSToData.$(pByteString(userAddr.paymentCreds.hash.toBuffer())),
          beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
          status: pIntToData.$(1)
        })
      }
    ],
    mints: [{
      value: new Value([
        {
          policy,
          assets: { "stADA": BigInt(mintAmount) },
        }
      ]),
      script: {
        inline: Script.fromJson({ "keyHash": "ef087eaefe5951cfd65121f7331e9fd0b5243c8f192d445e0bcfb88c", "type": "sig" }),
        policyId: policy,
        redeemer: new DataI(0)
      }
    }],
    requiredSigners: [beneficiaryWithStake.paymentCreds.hash], // required to be included in script context
    collaterals: [beneficiaryWithStakeUTxO as UTxO],
    changeAddress: beneficiaryWithStake,
    invalidBefore: cli.query.tipSync().slot
  });

  tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });
  tx = await cli.transaction.sign({ tx, privateKey: policyPrivateKey });

  await cli.transaction.submit({ tx });
}