import { Address, isData, UTxO, DataB, DataI } from "@harmoniclabs/plu-ts";
import { BrowserWallet } from "@meshsdk/core";
import { koios } from "../offchain/koios";
import { scriptMainnetAddr, beneficiary } from "../contracts/stakeContract";

export async function queryMintTxs(wallet: BrowserWallet): Promise<[UTxO[], Address]> {
  const myAddrs = (await wallet.getUsedAddresses()).map(Address.fromString);

  myAddrs.map(addr => {
    console.log('used addrs: ', addr.paymentCreds.hash.toString());
  })

  let myAddr!: Address;

  console.log('beneficiary: ', beneficiary.paymentCreds.hash.toString());

  const utxosToSpend = (await koios.address.utxos(scriptMainnetAddr))
    .filter(utxo => {
      const datum = utxo.resolved.datum;
      const value = utxo.resolved.value.lovelaces;

      if (
        // datum is inline
        isData(datum)
      ) {
        const pkh = datum.toJson();

        // search if it corresponds to one of my public keys
        const myPkhIdx = myAddrs.findIndex(
          addr => {
            if (pkh.fields[0] && pkh.fields[1] && pkh.fields[2]) {
              return pkh.fields[0].bytes.toString() == addr.paymentCreds.hash.toString()
                && pkh.fields[1].bytes.toString() == beneficiary.paymentCreds.hash.toString()
                && pkh.fields[2].int == 0n
                && value > 1_000_000
            }
            return false;
          }
        );

        // not a pkh of mine; not an utxo I can unstake
        if (myPkhIdx < 0) return false;

        // else found my staked utxo
        myAddr = myAddrs[myPkhIdx];

        return true;
      }

      return false;
    });

  if (utxosToSpend.length == 0) {
    throw "uopsie, are you sure your tx had enough time to get to the blockchain?"
  }

  console.log(utxosToSpend);
  return [utxosToSpend, myAddr];
}