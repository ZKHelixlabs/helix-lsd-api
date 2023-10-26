import { CardanoCliPluts } from "@harmoniclabs/cardanocli-pluts";
import { config } from "dotenv";

config()

export const cli = new CardanoCliPluts({
    network: "mainnet",
    cardanoCliPath: "/home/admin/.local/bin/cardano-cli",
    protocolParamsPath: "/home/admin/helix-lsd-api/tokens/protocol.json",
    era: "babbage"
});