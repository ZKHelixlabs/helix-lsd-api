import { PPubKeyHash, str, bs, int, pstruct } from "@harmoniclabs/plu-ts";

// modify the Datum as you prefer
const BridgeDatum = pstruct({
    BridgeDatum: {
        user: PPubKeyHash.type,
        beneficiary: PPubKeyHash.type,
        status: int,
        oldValue: int,
        oldTime: int,
        evmAddress: bs
    }
});

export default BridgeDatum;