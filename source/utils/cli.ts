import { CardanoCliPluts } from "@harmoniclabs/cardanocli-pluts";
import { config } from "dotenv";

config()

export const cli = new CardanoCliPluts({
    network: "mainnet",
    cardanoCliPath: "/root/.local/bin/cardano-cli"
});