import { Address, bool, bs, compile, data, int, lam, makeValidator, papp, PaymentCredentials, pBool, pfn, phoist, pif, pintToBS, plet, pmatch, precursive, PScriptContext, pStr, ptrace, ptraceIfFalse, punsafeConvertType, Script, ScriptType, pstruct, PPubKeyHash, StakeCredentials } from "@harmoniclabs/plu-ts";

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

// export const scriptMainnetAddr = new Address(
//     "mainnet",
//     PaymentCredentials.script(script.hash)
// );

export const scriptMainnetAddr = Address.fromString('addr1z9r50tp2a8yyt42stv9dukh53z74qfr0arx2az54helsuhppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qsr5u64');

export const beneficiary = Address.fromString('addr1v8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfq0vsrkr');

export const beneficiaryWithStake =  Address.fromString('addr1q8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qnz5t2m');

export const stakeWallet = Address.fromString('addr1q8h02y837cjex0vwv0y8p08jlj5cc22mnqv6cm828rmk4qppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qzw42sz');

export default stakeContract;