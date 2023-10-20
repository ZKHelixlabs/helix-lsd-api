/** source/controllers/posts.ts */
import { Request, Response, NextFunction } from "express";
import { Tx, Script, Address, isData, UTxO, DataB, DataI, Value, pBSToData, pByteString, pIntToData, Hash28, PaymentCredentials, StakeCredentials } from "@harmoniclabs/plu-ts";
import { beneficiary, stakeWallet } from "../contracts/stakeContract";
import { cli } from "../utils/cli";
import { HexString } from "@harmoniclabs/plu-ts/dist/types/HexString";
import { koios } from "../utils/koios";
import VestingDatum from "../VestingDatum";

const mint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: any = req.body;

    const userAddrs = [Address.fromString(body.data.addr)];

    userAddrs.map(addr => {
      console.log('used addrs: ', addr.paymentCreds.hash.toString());
    })

    let userAddr!: Address;

    console.log('beneficiary: ', beneficiary.paymentCreds.hash.toString());

    const script = cli.utils.readScript("./mainnet/stakeContract.plutus.json");

    const scriptMainnetAddr = new Address(
      "mainnet",
      PaymentCredentials.script(script.hash),
      stakeWallet.stakeCreds
    );

    console.log('scriptMainnetAddr: ', scriptMainnetAddr.toJson());

    const utxosToSpend = (await koios.address.utxos(scriptMainnetAddr))
      .filter((utxo: UTxO) => {
        const datum = utxo.resolved.datum;
        const value = utxo.resolved.value.lovelaces;

        if (
          // datum is inline
          isData(datum)
        ) {
          const pkh = datum.toJson();

          console.log(pkh);

          // search if it corresponds to one of my public keys
          const myPkhIdx = userAddrs.findIndex(
            addr => {
              if (pkh.fields[0] && pkh.fields[1] && pkh.fields[2]) {
                return pkh.fields[0].bytes.toString() == addr.paymentCreds.hash.toString()
                  && pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
                  && pkh.fields[2].int == 0n
                  && value > 2_000_000n
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

    console.log('utxosToSpend: ', utxosToSpend);

    const paymentPrivateKey = cli.utils.readPrivateKey("./tokens/payment.skey");

    const beneficiaryWithStake = new Address(
      "mainnet",
      beneficiary.paymentCreds,
      stakeWallet.stakeCreds
    );

    console.log('beneficiaryWithStake: ', beneficiaryWithStake.toJson());

    const policyid = "bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4";
    const policy = new Hash28(policyid);
    const tokenName = "stADA";
    const tokenNameBase16 = "7374414441";

    const beneficiaryWithStakeUTxO = (await koios.address.utxos(beneficiaryWithStake)).find((u: UTxO) => u.resolved.value.map.find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] > 1_000n));

    console.log('beneficiaryWithStakeUTxO: ', beneficiaryWithStakeUTxO);
    if (!beneficiaryWithStakeUTxO) {
      throw new Error(
        "no utxos found at address " + beneficiaryWithStake.toString()
      );
    }

    const adaAmount = utxosToSpend[body.data.index].resolved.value.lovelaces;
    const stADAAmount = (adaAmount - 2_000_000n) / 1_000_000n;
    console.log("adaAmount: ", adaAmount);
    console.log("stADAAmount: ", stADAAmount);

    let tx = await cli.transaction.build({
      inputs: [
        {
          utxo: beneficiaryWithStakeUTxO
        },
        // {
        //   utxo: utxosToSpend[body.data.index],
        //   inputScript: {
        //     script: script,
        //     datum: "inline",
        //     redeemer: new DataI(0)
        //   }
        // }
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
              assets: { [tokenName]: BigInt(stADAAmount) },
            }
          ]),
        },
        // {
        //   address: scriptMainnetAddr,
        //   value: Value.lovelaces(adaAmount - 2_000_000n),
        //   datum: VestingDatum.VestingDatum({
        //     user: pBSToData.$(pByteString(userAddr.paymentCreds.hash.toBuffer())),
        //     beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
        //     status: pIntToData.$(1)
        //   })
        // },
      ],
      // requiredSigners: [beneficiary.paymentCreds.hash],
      // collaterals: [beneficiaryWithStakeUTxO],
      changeAddress: beneficiaryWithStake,
    });

    tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });

    // const txid = (await koios.tx.submit(tx)).toString();
    const txid = "";
    console.log(txid);

    return res.status(200).json({ status: "ok", data: { txid, stADAAmount } });
  } catch (error: any) {
    return res.status(401).json({ error: error.toString() });
  }
};

export default { mint };
