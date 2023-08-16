const mxw = require('mxw-sdk-js');
const { LedgerSigner } = require('..');
const Transport = require("@ledgerhq/hw-transport-node-hid").default;

let provider = new mxw.providers.JsonRpcProvider("https://alloys-rpc.maxonrow.com", { chainId: "alloys", name: "alloys" });

LedgerSigner.connect(Transport, provider).then((signer) => {

    signer.getConfig().then((config) => {
        console.log('config', config);
    })

    signer.getAddress().then((address) => {
        console.log('Address', address);
    });

    signer.getHexAddress().then((address) => {
        console.log('Hex Address', address);
    });

    signer.getBalance().then((balance) => {
        console.log("balance", balance);
    })

    signer.getAccountNumber().then((accountNumber) => {
        console.log("account number", accountNumber);
    })

    signer.getTransactionCount().then((nonce) => {
        console.log("nonce", nonce);
    });

    signer.getCompressedPublicKey().then((key) => {
        console.log("public key", key.toString("hex"));
    });

    signer.getPublicKeyType().then((type) => {
        console.log("type", type);
    });

    let transaction = { "type": "cosmos-sdk/StdTx", "value": { "msg": [{ "type": "mxw/msgSend", "value": { "amount": [{ "amount": "10000000000000", "denom": "cin" }], "from_address": "mxw1edl2ef5c45acvn7062lgz53szyspqx7psxrm4w", "to_address": "mxw1hl456zwwc2vl3rq6p4y2amhvpn8znhzt9axn35" } }], "memo": "this is a memo test" }, "fee": { "amount": [{ "amount": "0", "denom": "cin" }], "gas": "0" }, "chainId": "alloys", "nonce": 75, "accountNumber": 778 };

    signer.sign(transaction).then((tx) => {
        console.log('Transaction', tx);
    });

    let kyc = { "from": "mxw1xctkm9fx7msfn0tthwnwdrcyms9tg0u2f98hpv", "kycAddress": "0x5dae11613ac214eda7febcf8f7a360ffe620a685e324aa43e1f399f2290631e5", "nonce": "0" };

    signer.signMessage(JSON.stringify(kyc)).then((tx) => {
        console.log('kyc', tx);
    });
});

