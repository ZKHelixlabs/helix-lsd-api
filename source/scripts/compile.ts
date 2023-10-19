import { existsSync } from "fs";
import { cli } from "../utils/cli";
import { script } from "../contracts/stakeContract";
import { mkdir } from "fs/promises";

console.log("validator compiled succesfully! 🎉\n");
console.log(
    JSON.stringify(
        script.toJson(),
        undefined,
        2
    )
);

async function compile() 
{
    if( !existsSync("./mainnet") )
    {
        await mkdir("./mainnet");
    }
    cli.utils.writeScript( script, "./mainnet/stakeContract.plutus.json")
}
compile();