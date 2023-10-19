import { Address, DataI, PaymentCredentials } from "@harmoniclabs/plu-ts";
import { cli } from "../utils/cli";

async function claimVesting()
{
    const script = cli.utils.readScript("./testnet/vesting.plutus.json");

    const scriptAddr = new Address(
        "testnet",
        PaymentCredentials.script( script.hash )
    );
    
    const privateKey = cli.utils.readPrivateKey("./testnet/payment2.skey");
    const addr = cli.utils.readAddress("./testnet/address2.addr");

    const utxos = await cli.query.utxo({ address: addr });
    const scriptUtxos = await cli.query.utxo({ address: scriptAddr });

    if( utxos.length === 0 || scriptUtxos.length === 0 )
    {
        throw new Error(
            "no utxos found at address " + addr.toString()
        );
    }

    const utxo = utxos[0];

    const pkh = privateKey.derivePublicKey().hash;

    let tx = await cli.transaction.build({
        inputs: [
            { utxo: utxo },
            {
                utxo: scriptUtxos[0],
                inputScript: {
                    script: script,
                    datum: "inline",
                    redeemer: new DataI( 0 )
                }
            }
        ],
        requiredSigners: [ pkh ], // required to be included in script context
        collaterals: [ utxo ],
        changeAddress: addr,
        invalidBefore: cli.query.tipSync().slot
    });

    tx = await cli.transaction.sign({ tx, privateKey });

    await cli.transaction.submit({ tx: tx });
}

if( process.argv[1].includes("claimVesting") )
{
    claimVesting();
}