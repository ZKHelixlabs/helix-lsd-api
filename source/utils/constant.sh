------NODE------

cardano-node run --config /home/admin/cardano/mainnet/config.json --database-path /home/admin/cardano/mainnet/db/ --socket-path /home/admin/cardano/mainnet/db/node.socket --host-addr 0.0.0.0 --port 1337 --topology /home/admin/cardano/mainnet/topology.json

cardano-node run --config /home/admin/cardano/testnet/config.json --database-path /home/admin/cardano/testnet/db/ --socket-path /home/admin/cardano/testnet/db/node.socket --host-addr 0.0.0.0 --port 1337 --topology /home/admin/cardano/testnet/topology.json

cardano-cli query tip --mainnet
cardano-cli query tip --testnet-magic 1

------MINT------

address="addr1q8g3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfppvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qnz5t2m"
network="--mainnet"

address="addr_test1vrg3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfq5yylex"
network="--testnet-magic 1"

cardano-cli query utxo --address $address $network

txhash="609a8e2e6aee4d618b1a919fb6e252d4bd4b62162c59d040983271a58c23ba9a"
txix="0"
funds="10000000000"

policyid=$(cat policy/policyID)
fee="300000"
tokenname="7374414441"
tokenamount="10000000"
output="0"

cardano-cli transaction build-raw  --fee $fee  --tx-in $txhash#$txix  --tx-out $address+$output+"$tokenamount $policyid.$tokenname"  --mint "$tokenamount $policyid.$tokenname"  --minting-script-file policy/policy.script  --out-file matx.raw

fee=$(cardano-cli transaction calculate-min-fee --tx-body-file matx.raw --tx-in-count 1 --tx-out-count 1 --witness-count 2 $network --protocol-params-file protocol_test.json | cut -d " " -f1)
output=$(expr $funds - $fee)

cardano-cli transaction sign  --signing-key-file payment.skey  --signing-key-file policy/policy.skey  $network --tx-body-file matx.raw  --out-file matx.signed
cardano-cli transaction submit --tx-file matx.signed $network

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

------TRANSFER------

tokenname="7374414441"
fee="0"
receiver="addr_test1qp625wsc3y7prsya8mavvn4mmmv962fx4r3k7xl5uakxvjepvv7gwasnw0nw4cdzquzz7l6k8azs34w3j29d8glev64qmntwrh"
receiver_output="10000000"
txhash="d21762fb2cb4738e4d9246c5fb363836b52c50c71c8f0fb9c5dc7af949d127fb"
txix="0"
funds="9999818483"

address="addr_test1vrg3t56p8rqm4gh9zmu9rx4y5n00qwn0qll7a2ra9z9hlfq5yylex"
network="--testnet-magic 1"

cardano-cli query utxo --address $address $network

echo Tokenname: $tokenname
echo Address: $address
echo Policy ID: $policyid

cardano-cli transaction build-raw  \
--fee $fee  \
--tx-in $txhash#$txix  \
--tx-out $receiver+$receiver_output+"5000000 $policyid.$tokenname"  \
--tx-out $address+$output+"5000000 $policyid.$tokenname"  \
--out-file rec_matx.raw

fee=$(cardano-cli transaction calculate-min-fee --tx-body-file rec_matx.raw --tx-in-count 1 --tx-out-count 2 --witness-count 1 $network --protocol-params-file protocol_test.json | cut -d " " -f1)
output=$(expr $funds - $fee - 10000000)

cardano-cli transaction sign --signing-key-file payment.skey $network --tx-body-file rec_matx.raw --out-file rec_matx.signed
cardano-cli transaction submit --tx-file rec_matx.signed $network