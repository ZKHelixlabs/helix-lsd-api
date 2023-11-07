import { PPubKeyHash, str, int, pstruct } from "@harmoniclabs/plu-ts";

// modify the Datum as you prefer
const VestingDatum = pstruct({
    VestingDatum: {
        user: PPubKeyHash.type,
        beneficiary: PPubKeyHash.type,
        status: int,
        oldValue: int,
        oldTime: str
    }
});

export default VestingDatum;