import { CardanoCliPluts } from "@harmoniclabs/cardanocli-pluts";
import { config } from "dotenv";

config()

export const cli = new CardanoCliPluts({
    network: "testnet 1",
    cardanoCliPath: "/home/admin/.local/bin/cardano-cli"
});