------MINT------

cardano-cli query utxo --address addr1q8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qnz5t2m --mainnet

txhash="f2d10a3da3c58ec7b823e5fb55e82881469db093006b41101e3ace6f3f67f3ef"
txix="1"
funds="2000000"
policyid=$(cat policy/policyID)
fee="300000"
tokenname="7374414441"
tokenamount="10000000"
output="0"
address="addr1q8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qnz5t2m"

cardano-cli transaction build-raw  --fee $fee  --tx-in $txhash#$txix  --tx-out $address+$output+"$tokenamount $policyid.$tokenname"  --mint "$tokenamount $policyid.$tokenname"  --minting-script-file policy/policy.script  --out-file matx.raw

fee=$(cardano-cli transaction calculate-min-fee --tx-body-file matx.raw --tx-in-count 1 --tx-out-count 1 --witness-count 2 --mainnet --protocol-params-file protocol.json | cut -d " " -f1)
output=$(expr $funds - $fee)

cardano-cli transaction sign  --signing-key-file payment.skey  --signing-key-file policy/policy.skey  --mainnet --tx-body-file matx.raw  --out-file matx.signed
cardano-cli transaction submit --tx-file matx.signed --mainnet

------BURN------

cardano-cli query utxo --address addr1q8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qnz5t2m --mainnet

txhash="56165d95f89fe49089b9500a61b79f0c350a99e41e8652b2179b967a56b6e4cb"
txix="0"
funds="1817515"
burnfee="0"
policyid=$(cat policy/policyID)
burnoutput="0"
tokenname="7374414441"
address="addr1q8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qnz5t2m"

cardano-cli transaction build-raw \
 --fee $burnfee \
 --tx-in $txhash#$txix \
 --tx-out $address+$burnoutput+"0 $policyid.$tokenname"  \
 --mint="-10000000 $policyid.$tokenname" \
 --minting-script-file policy/policy.script \
 --out-file burning.raw

burnfee=$(cardano-cli transaction calculate-min-fee --tx-body-file burning.raw --tx-in-count 1 --tx-out-count 1 --witness-count 2 --mainnet --protocol-params-file protocol.json | cut -d " " -f1)
burnoutput=$(expr $funds - $burnfee)

cardano-cli transaction sign  \
--signing-key-file payment.skey  \
--signing-key-file policy/policy.skey  \
--mainnet  \
--tx-body-file burning.raw  \
--out-file burning.signed

cardano-cli transaction submit --tx-file burning.signed --mainnet