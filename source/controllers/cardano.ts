/** source/controllers/posts.ts */
import { Request, Response, NextFunction } from "express";
import { Tx, Script, Address, isData, UTxO, Data, DataB, DataI, Value, pBSToData, pInt, pByteString, pIntToData, Hash28, PaymentCredentials, StakeCredentials } from "@harmoniclabs/plu-ts";
import { beneficiary, stakeWallet } from "../contracts/stakeContract";
import { cli } from "../utils/cli";
import { koios } from "../utils/koios";
import { ethers } from 'ethers';
import StakeDatum from "../StakeDatum";

const provider = new ethers.providers.JsonRpcProvider('https://l2rpc.helixlabs.org');
const wallets = (process.env.WALLETS as string).split(',').map(item => new ethers.Wallet(item, provider));

const bridgeAddr = '0x8C9aC5e18adbD025305E398350aaa0d77806B9Cb';
const bridgeAbi = [
  'function orders(string memory cardanoAddress, uint256 orderId) public view returns (address, uint256, uint256, uint256)',
  'function claim(string memory cardanoAddress, uint256 orderId) external'
];

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

    const scriptMainnetAddrWithStake = new Address(
      "mainnet",
      PaymentCredentials.script(script.hash),
      stakeWallet.stakeCreds
    );

    console.log('scriptMainnetAddrWithStake: ', scriptMainnetAddrWithStake.toJson());

    const utxosToSpend = (await koios.address.utxos(scriptMainnetAddrWithStake))
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
      "mainnet",
      beneficiary.paymentCreds,
      stakeWallet.stakeCreds
    );

    console.log('beneficiaryWithStake: ', beneficiaryWithStake.toJson());

    const policyid = "bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4";
    const policy = new Hash28(policyid);
    const tokenName = "hstADA";
    const tokenNameBase16 = "687374414441";

    const beneficiaryWithStakeHSTADAUTxO = (await cli.query.utxo({ address: beneficiaryWithStake })).find((u: UTxO) => u.resolved.value.map.find((item: any) => item.policy.toString() == policyid && item.assets[tokenName] >= 1_000_000_000n));

    console.log('beneficiaryWithStakeHSTADAUTxO: ', beneficiaryWithStakeHSTADAUTxO?.resolved.value.toJson());

    if (!beneficiaryWithStakeHSTADAUTxO) {
      throw new Error(
        "no hstADA utxos found at address " + beneficiaryWithStake.toString()
      );
    }

    const beneficiaryWithStakeADAUTxO = (await cli.query.utxo({ address: beneficiaryWithStake })).find((u: UTxO) => u.resolved.value.map.length == 1 && u.resolved.value.lovelaces >= 1_500_000n);

    console.log('beneficiaryWithStakeADAUTxO: ', beneficiaryWithStakeADAUTxO?.resolved.value.toJson());

    if (!beneficiaryWithStakeADAUTxO) {
      throw new Error(
        "no ADA utxos found at address " + beneficiaryWithStake.toString()
      );
    }

    const adaAmount = utxosToSpend[body.data.index].resolved.value.lovelaces;
    const hstADAAmount = adaAmount - 2_000_000n;
    console.log("adaAmount: ", adaAmount);
    console.log("hstADAAmount: ", hstADAAmount);

    let tx = await cli.transaction.build({
      inputs: [
        {
          utxo: beneficiaryWithStakeHSTADAUTxO
        },
        {
          utxo: utxosToSpend[body.data.index],
          inputScript: {
            script: script,
            datum: "inline",
            redeemer: new DataI(0)
          }
        }
      ],
      outputs: [
        {
          address: usedAddrs[body.data.index],
          value: new Value([
            {
              policy: "",
              assets: { "": 2_000_000n },
            },
            {
              policy,
              assets: { [tokenName]: hstADAAmount },
            }
          ]),
        },
        {
          address: scriptMainnetAddrWithStake,
          value: Value.lovelaces(adaAmount - 2_000_000n),
          datum: StakeDatum.StakeDatum({
            user: pBSToData.$(pByteString(usedAddrs[body.data.index].paymentCreds.hash.toBuffer())),
            beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
            status: pIntToData.$(1),
            oldValue: pIntToData.$(0),
            oldTime: pIntToData.$(new Date().getTime())
          })
        },
      ],
      requiredSigners: [beneficiary.paymentCreds.hash],
      collaterals: [beneficiaryWithStakeADAUTxO],
      changeAddress: beneficiaryWithStake,
      invalidBefore: cli.query.tipSync().slot
    });

    tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });

    await cli.transaction.submit({ tx: tx });
    console.log("Minted success: ", hstADAAmount, "hstADA");

    return res.status(200).json({ status: "ok", data: { hstADAAmount: hstADAAmount.toString() } });
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

    const scriptMainnetAddrWithStake = new Address(
      "mainnet",
      PaymentCredentials.script(script.hash),
      stakeWallet.stakeCreds
    );

    console.log('scriptMainnetAddrWithStake: ', scriptMainnetAddrWithStake.toJson());

    const policyid = "bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4";
    const policy = new Hash28(policyid);
    const tokenName = "hstADA";
    const tokenNameBase16 = "687374414441";

    const utxosToSpend = (await koios.address.utxos(scriptMainnetAddrWithStake))
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
                  && valueMap.find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] >= 1_000_000n)
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

    const hstADAAmount = (utxosToSpend[body.data.index].resolved.value.map as any).find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] >= 1_000_000n).assets[tokenNameBase16];
    const adaAmount = hstADAAmount;
    console.log("hstADAAmount: ", hstADAAmount);
    console.log("adaAmount: ", adaAmount);

    const adaUtxosToSpend = (await koios.address.utxos(scriptMainnetAddrWithStake))
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
                return pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
                  && pkh.fields[2].int == 1n
                  && value >= adaAmount + 2_000_000n
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
    const oldUser = (adaUtxosToSpend[0].resolved.datum as Data).toJson().fields[0].bytes;
    const oldValue = (adaUtxosToSpend[0].resolved.datum as Data).toJson().fields[3];
    const oldTime = (adaUtxosToSpend[0].resolved.datum as Data).toJson().fields[4];

    console.log('oldAdaAmount: ', oldAdaAmount);
    console.log('oldUser: ', oldUser);
    console.log('oldValue: ', oldValue);
    console.log('oldTime: ', oldTime);

    const paymentPrivateKey = cli.utils.readPrivateKey("./tokens/payment.skey");

    const beneficiaryWithStake = new Address(
      "mainnet",
      beneficiary.paymentCreds,
      stakeWallet.stakeCreds
    );

    console.log('beneficiaryWithStake: ', beneficiaryWithStake.toJson());

    const beneficiaryWithStakeUTxO = (await cli.query.utxo({ address: beneficiaryWithStake })).find((u: UTxO) => u.resolved.value.map.length == 1 && u.resolved.value.lovelaces >= 1_500_000n);

    console.log('beneficiaryWithStakeUTxO: ', beneficiaryWithStakeUTxO?.resolved.value.toJson());

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
        {
          utxo: utxosToSpend[body.data.index],
          inputScript: {
            script: script,
            datum: "inline",
            redeemer: new DataI(0)
          }
        },
        {
          utxo: adaUtxosToSpend[0],
          inputScript: {
            script: script,
            datum: "inline",
            redeemer: new DataI(0)
          }
        },
      ],
      outputs: [
        {
          address: usedAddrs[body.data.index],
          value: Value.lovelaces(adaAmount)
        },
        {
          address: scriptMainnetAddrWithStake,
          value: new Value([
            {
              policy: "",
              assets: { "": 2_000_000n },
            },
            {
              policy,
              assets: { [tokenName]: hstADAAmount },
            }
          ]),
          datum: StakeDatum.StakeDatum({
            user: pBSToData.$(pByteString(usedAddrs[body.data.index].paymentCreds.hash.toBuffer())),
            beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
            status: pIntToData.$(3),
            oldValue: pIntToData.$(0),
            oldTime: pIntToData.$(0),
          })
        },
        {
          address: scriptMainnetAddrWithStake,
          value: Value.lovelaces(oldAdaAmount - adaAmount),
          datum: StakeDatum.StakeDatum({
            user: pBSToData.$(pByteString(oldUser)),
            beneficiary: pBSToData.$(pByteString(beneficiary.paymentCreds.hash.toBuffer())),
            status: pIntToData.$(1),
            oldValue: pIntToData.$(oldValue && oldValue.int > 0 ? pInt(oldValue.int) : oldAdaAmount),
            oldTime: pIntToData.$(oldTime && oldTime.int > 0 ? pInt(oldTime.int) : new Date().getTime()),
          })
        },
      ],
      requiredSigners: [beneficiary.paymentCreds.hash],
      collaterals: [beneficiaryWithStakeUTxO],
      changeAddress: beneficiaryWithStake,
      invalidBefore: cli.query.tipSync().slot
    });

    tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });

    await cli.transaction.submit({ tx: tx });
    console.log("Withdrawn success: ", hstADAAmount, "ADA");

    return res.status(200).json({ status: "ok", data: { adaAmount: adaAmount.toString() } });
  } catch (error: any) {
    return res.status(401).json({ error: error.toString() });
  }
};

const getSignature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const script = cli.utils.readScript("./mainnet/bridgeContract.plutus.json");

    const scriptMainnetAddrWithStake = new Address(
      "mainnet",
      PaymentCredentials.script(script.hash),
      stakeWallet.stakeCreds
    );

    const policyid = "bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4";
    const policy = new Hash28(policyid);
    const tokenName = "hstADA";
    const tokenNameBase16 = "687374414441";

    const userAddrs: any[] = ['addr1'];

    const utxosToSpend = (await koios.address.utxos(scriptMainnetAddrWithStake))
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
              if (pkh.fields[1] && pkh.fields[2] && pkh.fields[5] && utxo.utxoRef.id.toString() == req.params.txid) {
                return pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
                  && pkh.fields[2].int == 0n
                  && pkh.fields[5].bytes.toString() == pByteString(Buffer.from(req.params.evmAddress)).toIR().toJson().value.toString()
                  && valueMap.find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] >= 1_000_000n)
              }
              return false;
            }
          );

          // not a pkh of mine; not an utxo I can unstake
          if (myPkhIdx < 0) return false;

          return true;
        }

        return false;
      });

    if (utxosToSpend.length > 0) {
      const hstADAAmount = (utxosToSpend[0].resolved.value.map as any).find((item: any) => item.policy.toString() == policyid && item.assets[tokenNameBase16] >= 1_000_000n).assets[tokenNameBase16];
      const messageHash = ethers.utils.solidityKeccak256(["address", "uint256", "string", "address"], [req.params.evmAddress, ethers.utils.parseUnits(ethers.utils.formatUnits(hstADAAmount, 6)), req.params.txid, bridgeAddr]);
      const messageHashBinary = ethers.utils.arrayify(messageHash);

      const signature = await wallets[0].signMessage(messageHashBinary);

      return res.status(200).json({ status: "ok", signature });
    } else {
      return res.status(401).json({ error: 'No bridge results' });
    }
  } catch (error: any) {
    return res.status(401).json({ error: error.toString() });
  }
};

const mintSTADA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: any = req.body;

    const bridge = new ethers.Contract(bridgeAddr, bridgeAbi, provider);
    const order = await bridge.orders(body.data.cardanoAddress, body.data.orderId);

    if (order.length == 4) {
      if (order[3] == 0) {
        console.log('beneficiary: ', beneficiary.paymentCreds.hash.toString());

        const paymentPrivateKey = cli.utils.readPrivateKey("./tokens/payment.skey");

        const beneficiaryWithStake = new Address(
          "mainnet",
          beneficiary.paymentCreds,
          stakeWallet.stakeCreds
        );

        console.log('beneficiaryWithStake: ', beneficiaryWithStake.toJson());

        const policyid = "bc8dc1c63df795e248d767e5dc413b7c390f3b76e843a26be96e45b4";
        const policy = new Hash28(policyid);
        const tokenName = "hstADA";
        const tokenNameBase16 = "687374414441";

        const beneficiaryWithStakeHSTADAUTxO = (await cli.query.utxo({ address: beneficiaryWithStake })).find((u: UTxO) => u.resolved.value.map.find((item: any) => item.policy.toString() == policyid && item.assets[tokenName] >= 1_000_000_000n));

        console.log('beneficiaryWithStakeHSTADAUTxO: ', beneficiaryWithStakeHSTADAUTxO?.resolved.value.toJson());

        if (!beneficiaryWithStakeHSTADAUTxO) {
          throw new Error(
            "no hstADA utxos found at address " + beneficiaryWithStake.toString()
          );
        }

        const beneficiaryWithStakeADAUTxO = (await cli.query.utxo({ address: beneficiaryWithStake })).find((u: UTxO) => u.resolved.value.map.length == 1 && u.resolved.value.lovelaces >= 3_000_000n);

        console.log('beneficiaryWithStakeADAUTxO: ', beneficiaryWithStakeADAUTxO?.resolved.value.toJson());

        if (!beneficiaryWithStakeADAUTxO) {
          throw new Error(
            "no ADA utxos found at address " + beneficiaryWithStake.toString()
          );
        }

        const hstADAAmount = ethers.utils.parseUnits(ethers.utils.formatUnits(order[1]), 6).toNumber();

        let tx = await cli.transaction.build({
          inputs: [
            {
              utxo: beneficiaryWithStakeADAUTxO
            },
            {
              utxo: beneficiaryWithStakeHSTADAUTxO
            },
          ],
          outputs: [
            {
              address: body.data.cardanoAddress,
              value: new Value([
                {
                  policy: "",
                  assets: { "": 2_000_000n },
                },
                {
                  policy,
                  assets: { [tokenName]: hstADAAmount },
                }
              ]),
            },
          ],
          requiredSigners: [beneficiary.paymentCreds.hash],
          collaterals: [beneficiaryWithStakeADAUTxO],
          changeAddress: beneficiaryWithStake,
          invalidBefore: cli.query.tipSync().slot
        });

        tx = await cli.transaction.sign({ tx, privateKey: paymentPrivateKey });

        await cli.transaction.submit({ tx: tx });
        console.log("Minted success: ", hstADAAmount, "hstADA");

        const txs = await bridge.connect(wallets[0]).claim(body.data.cardanoAddress, body.data.orderId);
        const receipt = await txs.wait();

        return res.status(200).json({ status: "ok", data: { hstADAAmount: hstADAAmount.toString() } });
      } else {
        return res.status(401).json({ error: 'You have already withdrawn this payment' });
      }
    } else {
      return res.status(401).json({ error: 'No bridge results' });
    }
  } catch (error: any) {
    return res.status(401).json({ error: error.toString() });
  }
};

export default { mint, withdraw, getSignature, mintSTADA };
