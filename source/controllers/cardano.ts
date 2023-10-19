/** source/controllers/posts.ts */
import { Request, Response, NextFunction } from "express";
import { Tx, Script, Address, isData, UTxO, DataB, DataI, Value, pBSToData, pByteString, pIntToData, Hash28, PaymentCredentials, StakeCredentials } from "@harmoniclabs/plu-ts";
import { beneficiary, stakeWallet } from "../contracts/stakeContract";
import { cli } from "../utils/cli";

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

    console.log(scriptMainnetAddr.toJson());

    const utxosToSpend = await cli.query.utxo({ address: scriptMainnetAddr });

    // const utxosToSpend = (await cli.query.utxo({ address: scriptMainnetAddr }))
    //   .filter((utxo: UTxO) => {
    //     const datum = utxo.resolved.datum;
    //     const value = utxo.resolved.value.lovelaces;

    //     if (
    //       // datum is inline
    //       isData(datum)
    //     ) {
    //       const pkh = datum.toJson();

    //       // search if it corresponds to one of my public keys
    //       const myPkhIdx = userAddrs.findIndex(
    //         addr => {
    //           if (pkh.fields[0] && pkh.fields[1] && pkh.fields[2]) {
    //             return pkh.fields[0].bytes.toString() == addr.paymentCreds.hash.toString()
    //               && pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
    //               && pkh.fields[2].int == 0n
    //               && value > 2_000_000
    //           }
    //           return false;
    //         }
    //       );

    //       // not a pkh of mine; not an utxo I can unstake
    //       if (myPkhIdx < 0) return false;

    //       // else found my staked utxo
    //       userAddr = userAddrs[myPkhIdx];

    //       return true;
    //     }

    //     return false;
    //   });

    if (utxosToSpend.length == 0) {
      throw "uopsie, are you sure your tx had enough time to get to the blockchain?"
    }

    console.log(utxosToSpend);

    const paymentPrivateKey = cli.utils.readPrivateKey("/tokens/payment.skey");

    const beneficiaryWithStake = new Address(
      "mainnet",
      beneficiary.paymentCreds,
      stakeWallet.stakeCreds
    );

    const beneficiaryWithStakeUTxO = (await cli.query.utxo({ address: beneficiaryWithStake })).find((u: UTxO) => u.resolved.value.lovelaces > 1_000_000);

    console.log(beneficiaryWithStakeUTxO);

    const mintAmount = utxosToSpend[body.data.index].resolved.value.lovelaces - 2_000_000n;

    const policy = new Hash28("bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4");

    let tx = await cli.transaction.build({
      inputs: [
        {
          utxo: beneficiaryWithStakeUTxO as UTxO,
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
      ],
      changeAddress: beneficiaryWithStake,
    });

    tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });

    // await cli.transaction.submit({ tx });

    return res.status(200).json({ status: "ok" });
  } catch (error: any) {
    return res.status(401).json({ error: error.toString() });
  }
};

export default { mint };
