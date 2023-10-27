/** source/controllers/posts.ts */
import { Request, Response, NextFunction } from "express";
import { Tx, Script, Address, isData, UTxO, DataB, DataI, Value, pBSToData, pByteString, pIntToData, Hash28, PaymentCredentials, StakeCredentials } from "@harmoniclabs/plu-ts";
import { beneficiary, stakeWallet } from "../contracts/stakeContract";
import { cli } from "../utils/cli";
import { koios } from "../utils/koios";
import VestingDatum from "../VestingDatum";

const mint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: any = req.body;

    const userAddrs = body.data.addrs.map(Address.fromString);

    userAddrs.map((addr: Address) => {
      console.log('used addrs: ', addr.paymentCreds.hash.toString());
    })

    let usedAddrs: Address[] = [];

    console.log('beneficiary: ', beneficiary.paymentCreds.hash.toString());

    const script = cli.utils.readScript("./mainnet/stakeContract.plutus.json");

    const scriptMainnetAddr = new Address(
      "testnet",
      PaymentCredentials.script(script.hash),
      // stakeWallet.stakeCreds
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

          // search if it corresponds to one of my public keys
          const myPkhIdx = userAddrs.findIndex(
            (addr: Address) => {
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
          usedAddrs.push(userAddrs[myPkhIdx]);

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
      "testnet",
      beneficiary.paymentCreds,
      // stakeWallet.stakeCreds
    );

    console.log('beneficiaryWithStake: ', beneficiaryWithStake.toJson());

    const policyid = "bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4";
    const policy = new Hash28(policyid);
    // const tokenName = "stADA";
    // const tokenNameBase16 = "7374414441";
    const tokenName = "Testtoken";
    const tokenNameBase16 = "54657374746F6B656e";

    // const beneficiaryWithStakeUTxO = (await koios.address.utxos(beneficiaryWithStake)).find((u: UTxO) => u.resolved.value.map.find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] > 1_000n));

    const beneficiaryWithStakeUTxO = (await koios.address.utxos(beneficiaryWithStake))[0];

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
        {
          utxo: utxosToSpend[body.data.index],
          inputScript: {
            script: script,
            datum: "inline",
            redeemer: new DataB("")
          }
        }
      ],
      // outputs: [
      //   {
      //     address: usedAddrs[body.data.index],
      //     value: new Value([
      //       {
      //         policy: "",
      //         assets: { "": 2_000_000n },
      //       },
      //       {
      //         policy,
      //         assets: { [tokenName]: stADAAmount },
      //       }
      //     ]),
      //   },
      //   {
      //     address: scriptMainnetAddr,
      //     value: Value.lovelaces(adaAmount - 2_000_000n),
      //     datum: VestingDatum.VestingDatum({
      //       user: pBSToData.$(pByteString(usedAddrs[body.data.index].paymentCreds.hash.toBuffer())),
      //       beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
      //       status: pIntToData.$(1)
      //     })
      //   },
      // ],
      requiredSigners: [beneficiary.paymentCreds.hash],
      collaterals: [beneficiaryWithStakeUTxO],
      changeAddress: beneficiaryWithStake
    });

    tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });

    const txid = (await koios.tx.submit(tx)).toString();
    // const txid = tx.toJson();
    console.log("txid: ", txid);

    return res.status(200).json({ status: "ok", data: { txid, stADAAmount: stADAAmount.toString() } });
  } catch (error: any) {
    return res.status(401).json({ error: error.toString() });
  }
};

const withdraw = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: any = req.body;

    const userAddrs = body.data.addrs.map(Address.fromString);

    userAddrs.map((addr: Address) => {
      console.log('used addrs: ', addr.paymentCreds.hash.toString());
    })

    let usedAddrs: Address[] = [];

    console.log('beneficiary: ', beneficiary.paymentCreds.hash.toString());

    const script = cli.utils.readScript("./mainnet/stakeContract.plutus.json");

    const scriptMainnetAddr = new Address(
      "testnet",
      PaymentCredentials.script(script.hash),
      // stakeWallet.stakeCreds
    );

    console.log('scriptMainnetAddr: ', scriptMainnetAddr.toJson());

    const utxosToSpend = (await koios.address.utxos(scriptMainnetAddr))
      .filter((utxo: UTxO) => {
        const datum = utxo.resolved.datum;
        const valueMap = utxo.resolved.value.map;

        if (
          // datum is inline
          isData(datum)
        ) {
          const pkh = datum.toJson();

          // search if it corresponds to one of my public keys
          const myPkhIdx = userAddrs.findIndex(
            (addr: Address) => {
              if (pkh.fields[0] && pkh.fields[1] && pkh.fields[2]) {
                return pkh.fields[0].bytes.toString() == addr.paymentCreds.hash.toString()
                  && pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
                  && pkh.fields[2].int == 2n
                  && valueMap.find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] >= 1n)
              }
              return false;
            }
          );

          // not a pkh of mine; not an utxo I can unstake
          if (myPkhIdx < 0) return false;

          // else found my staked utxo
          usedAddrs.push(userAddrs[myPkhIdx]);

          return true;
        }

        return false;
      });

    if (utxosToSpend.length == 0) {
      throw "uopsie, are you sure your tx had enough time to get to the blockchain?"
    }

    console.log('utxosToSpend: ', utxosToSpend);

    const policyid = "bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4";
    const policy = new Hash28(policyid);
    // const tokenName = "stADA";
    // const tokenNameBase16 = "7374414441";
    const tokenName = "Testtoken";
    const tokenNameBase16 = "54657374746F6B656E";


    const stADAAmount = (utxosToSpend[body.data.index].resolved.value.map as any).find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] >= 1n).assets[tokenNameBase16];
    const adaAmount = stADAAmount * 1_000_000n;
    console.log("stADAAmount: ", stADAAmount);
    console.log("adaAmount: ", adaAmount);

    const adaUtxosToSpend = (await koios.address.utxos(scriptMainnetAddr))
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
            (addr: Address) => {
              if (pkh.fields[0] && pkh.fields[1] && pkh.fields[2]) {
                return pkh.fields[0].bytes.toString() == addr.paymentCreds.hash.toString()
                  && pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
                  && pkh.fields[2].int == 1n
                  && value >= adaAmount
              }
              return false;
            }
          );

          // not a pkh of mine; not an utxo I can unstake
          if (myPkhIdx < 0) return false;

          // else found my staked utxo
          usedAddrs.push(userAddrs[myPkhIdx]);

          return true;
        }

        return false;
      });

    if (adaUtxosToSpend.length == 0) {
      throw "uopsie, are you sure your tx had enough time to get to the blockchain?"
    }

    console.log('adaUtxosToSpend: ', adaUtxosToSpend);

    const oldAdaAmount = adaUtxosToSpend[0].resolved.value.lovelaces;

    const paymentPrivateKey = cli.utils.readPrivateKey("./tokens/payment.skey");

    const beneficiaryWithStake = new Address(
      "testnet",
      beneficiary.paymentCreds,
      // stakeWallet.stakeCreds
    );

    console.log('beneficiaryWithStake: ', beneficiaryWithStake.toJson());

    const beneficiaryWithStakeUTxO = (await koios.address.utxos(beneficiaryWithStake)).find((u: UTxO) => u.resolved.value.lovelaces >= 1_000_000n);

    console.log('beneficiaryWithStakeUTxO: ', beneficiaryWithStakeUTxO);
    if (!beneficiaryWithStakeUTxO) {
      throw new Error(
        "no utxos found at address " + beneficiaryWithStake.toString()
      );
    }

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
        // },
        // {
        //   utxo: adaUtxosToSpend[0],
        //   inputScript: {
        //     script: script,
        //     datum: "inline",
        //     redeemer: new DataI(0)
        //   }
        // },
      ],
      outputs: [
        {
          address: usedAddrs[body.data.index],
          value: Value.lovelaces(adaAmount)
        },
        // {
        //   address: scriptMainnetAddr,
        //   value: new Value([
        //     {
        //       policy: "",
        //       assets: { "": 2_000_000n },
        //     },
        //     {
        //       policy,
        //       assets: { [tokenName]: stADAAmount },
        //     }
        //   ]),
        //   datum: VestingDatum.VestingDatum({
        //     user: pBSToData.$(pByteString(usedAddrs[body.data.index].paymentCreds.hash.toBuffer())),
        //     beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
        //     status: pIntToData.$(3)
        //   })
        // },
        // {
        //   address: scriptMainnetAddr,
        //   value: Value.lovelaces(oldAdaAmount - adaAmount),
        //   datum: VestingDatum.VestingDatum({
        //     user: pBSToData.$(pByteString(usedAddrs[body.data.index].paymentCreds.hash.toBuffer())),
        //     beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
        //     status: pIntToData.$(1)
        //   })
        // },
      ],
      // requiredSigners: [beneficiary.paymentCreds.hash],
      // collaterals: [beneficiaryWithStakeUTxO],
      changeAddress: beneficiaryWithStake,
    });
    console.log()

    tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });

    const txid = (await koios.tx.submit(tx)).toString();
    // const txid = "";
    console.log("txid: ", txid);

    return res.status(200).json({ status: "ok", data: { txid, stADAAmount: stADAAmount.toString() } });
  } catch (error: any) {
    return res.status(401).json({ error: error.toString() });
  }
};

export default { mint, withdraw };
