import { Address, PaymentCredentials, TxBuilder, Value, pBSToData, pByteString, pIntToData } from "@harmoniclabs/plu-ts";
import { cli } from "../utils/cli";
import VestingDatum from "../VestingDatum";

async function createVesting()
{
    const script = cli.utils.readScript("./testnet/vesting.plutus.json");

    const scriptAddr = new Address(
        "testnet",
        PaymentCredentials.script( script.hash )
    );
    
    const privateKey = cli.utils.readPrivateKey("./testnet/payment1.skey");
    const addr = cli.utils.readAddress("./testnet/address1.addr");
    const beneficiary = cli.utils.readPublicKey("./testnet/payment2.vkey");

    const utxos = await cli.query.utxo({ address: addr });

    if( utxos.length === 0 )
    {
        throw new Error(
            "no utxos found at address " + addr.toString()
        );
    }

    const utxo = utxos[0];

    const nowPosix = Date.now();

    let tx = await cli.transaction.build({
        inputs: [{ utxo: utxo }],
        collaterals: [ utxo ],
        outputs: [
            {
                address: scriptAddr,
                value: Value.lovelaces( 10_000_000 ),
                datum: VestingDatum.VestingDatum({
                    beneficiary: pBSToData.$( pByteString( beneficiary.hash.toBuffer() ) ),
                    user: pBSToData.$( pByteString( beneficiary.hash.toBuffer() ) ),
                    status: pIntToData.$( nowPosix + 10_000 ),
                })
            }
        ],
        changeAddress: addr
    });

    tx = await cli.transaction.sign({ tx, privateKey });

    await cli.transaction.submit({ tx: tx });
}

if( process.argv[1].includes("createVesting") )
{
    createVesting();
}