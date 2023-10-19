import { Address, bool, bs, compile, data, int, lam, makeValidator, papp, PaymentCredentials, pBool, pfn, phoist, pif, pintToBS, plet, pmatch, precursive, PScriptContext, pStr, ptrace, ptraceIfFalse, punsafeConvertType, Script, ScriptType, pstruct, PPubKeyHash, StakeCredentials } from "@harmoniclabs/plu-ts";
import { cli } from "../utils/cli";
import VestingDatum from "../VestingDatum";

const stakeContract = pfn([
    VestingDatum.type,
    data,
    PScriptContext.type
], bool)
    ((datum, _redeemer, ctx) => {
        // inlined
        const signedByBeneficiary = ctx.tx.signatories.some(datum.beneficiary.eqTerm);

        return signedByBeneficiary;
    });

///////////////////////////////////////////////////////////////////
// ------------------------------------------------------------- //
// ------------------------- utilities ------------------------- //
// ------------------------------------------------------------- //
///////////////////////////////////////////////////////////////////

export const untypedValidator = makeValidator(stakeContract);

export const compiledContract = compile(untypedValidator);

export const script = new Script(
    "PlutusScriptV2",
    compiledContract
);

export const scriptTestnetAddr = new Address(
    "testnet",
    PaymentCredentials.script(script.hash)
);

export const scriptMainnetAddr = new Address(
    "mainnet",
    PaymentCredentials.script(script.hash)
);

export const stakeWallet = Address.fromString('addr1q9625wsc3y7prsya8mavvn4mmmv962fx4r3k7xl5uakxvjepvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qc9kw0g');

export const beneficiary = Address.fromString('addr1v8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfq0vsrkr');

export default stakeContract;