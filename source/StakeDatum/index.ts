import { PPubKeyHash, str, int, pstruct } from "@harmoniclabs/plu-ts";

// modify the Datum as you prefer
const StakeDatum = pstruct({
    StakeDatum: {
        user: PPubKeyHash.type,
        beneficiary: PPubKeyHash.type,
        status: int,
        oldValue: int,
        oldTime: int
    }
});

export default StakeDatum;