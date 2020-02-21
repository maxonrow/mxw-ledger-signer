"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mxw_sdk_js_1 = require("mxw-sdk-js");
const ledger_mxw_js_1 = __importDefault(require("ledger-mxw-js"));
const utils_1 = require("mxw-sdk-js/dist/utils");
const secp256k1_1 = require("secp256k1");
const misc_1 = require("mxw-sdk-js/dist/utils/misc");
const transaction_1 = require("mxw-sdk-js/dist/utils/transaction");
const units_1 = require("mxw-sdk-js/dist/utils/units");
const hrp = "mxw";
const HardenedBit = 0x80000000;
function getPathArray(path) {
    var pathArray = [];
    let components = path.split('/');
    if (components.length === 0) {
        throw new Error('invalid path - ' + path);
    }
    if (components[0] === 'm') {
        components.shift();
    }
    for (let i = 0; i < components.length; i++) {
        let component = components[i];
        if (component.match(/^[0-9]+'$/)) {
            let index = parseInt(component.substring(0, component.length - 1));
            if (index >= HardenedBit) {
                throw new Error('invalid path index - ' + component);
            }
            pathArray.push(index);
        }
        else if (component.match(/^[0-9]+$/)) {
            let index = parseInt(component);
            if (index >= HardenedBit) {
                throw new Error('invalid path index - ' + component);
            }
            pathArray.push(index);
        }
        else {
            throw new Error('invalid path component - ' + component);
        }
    }
    return pathArray;
}
// We use this to serialize all calls to the Ledger; we should probably do this
// on a per-transport basis, but we only support one transport (per library)
let _pending = Promise.resolve(null);
class LedgerSigner extends mxw_sdk_js_1.Signer {
    constructor(transport, provider, options) {
        super();
        if (!options) {
            options = {};
        }
        if (!options.path) {
            options.path = mxw_sdk_js_1.mxw.utils.HDNode.defaultPath;
        }
        ;
        if (typeof (options.path) === 'string') {
            mxw_sdk_js_1.mxw.utils.defineReadOnly(this, 'path', getPathArray(options.path));
        }
        else if (Array.isArray(options.path)) {
            mxw_sdk_js_1.mxw.utils.defineReadOnly(this, 'path', options.path);
        }
        mxw_sdk_js_1.mxw.utils.defineReadOnly(this, 'provider', provider);
        mxw_sdk_js_1.mxw.utils.defineReadOnly(this, '_transport', transport);
        mxw_sdk_js_1.mxw.utils.defineReadOnly(this, '_mxw', new ledger_mxw_js_1.default(transport));
        this._ready = this.getAddressAndPubKey().then((result) => {
            this._addressAndPubKey = result;
            this.address = this._addressAndPubKey.bech32_address;
        });
        _pending = this._ready;
        this._config = JSON.stringify(null);
    }
    get config() {
        return JSON.parse(this._config);
    }
    getConfig() {
        return _pending.then(() => {
            return this._mxw.getVersion();
        });
    }
    getAddress() {
        let promise = _pending.then(() => {
            return this._addressAndPubKey.bech32_address;
        });
        _pending = promise;
        return promise;
    }
    sign(transaction, overrides) {
        if (transaction.nonce == null || transaction.accountNumber == null) {
            transaction = utils_1.shallowCopy(transaction);
            if (transaction.nonce == null) {
                transaction.nonce = this.getTransactionCount("pending");
            }
            if (transaction.accountNumber == null) {
                transaction.accountNumber = this.getAccountNumber();
            }
        }
        return utils_1.resolveProperties(transaction).then((tx) => {
            if (!tx.nonce || !tx.accountNumber || !tx.value || !tx.value.msg || !Array.isArray(tx.value.msg)) {
                mxw_sdk_js_1.errors.throwError('missing transaction field', mxw_sdk_js_1.errors.MISSING_ARGUMENT, { argument: 'value', value: tx });
            }
            if (!Array.isArray(tx.value.msg)) {
                mxw_sdk_js_1.errors.throwError('invalid transaction field', mxw_sdk_js_1.errors.MISSING_ARGUMENT, { argument: 'value', value: tx });
            }
            if (!tx.value.fee) {
                tx.value.fee = transaction.fee;
            }
            let payload = {
                account_number: tx.accountNumber.toString() || '0',
                chain_id: tx.chainId,
                fee: tx.fee,
                memo: tx.value.memo,
                msgs: tx.value.msg,
                sequence: '0'
            };
            // Control the nonce to cater bulk transaction submission
            if (overrides && overrides.bulkSend) {
                if (undefined !== this.nonce) {
                    if (this.nonce.gte(tx.nonce)) {
                        tx.nonce = this.nonce.add(1);
                    }
                }
            }
            this.nonce = tx.nonce;
            payload.sequence = tx.nonce.toString();
            // Convert number and big number to string
            payload = utils_1.iterate(payload, function (key, value, type) {
                switch (type) {
                    case "Number":
                    case "BigNumber":
                        return value.toString();
                }
                return value;
            });
            payload = misc_1.sortObject(payload);
            // Log signature payload
            if (overrides && overrides.logSignaturePayload) {
                overrides.logSignaturePayload(payload);
            }
            let signPromise = _pending.then(() => {
                return this._mxw.sign(this.path, JSON.stringify(payload)).then((signatureResponse) => {
                    if (signatureResponse.return_code !== 0x9000) {
                        mxw_sdk_js_1.errors.throwError(signatureResponse.error_message, mxw_sdk_js_1.errors.INVALID_ARGUMENT, { argument: transaction });
                    }
                    const signatureDER = signatureResponse.signature;
                    const signature = secp256k1_1.signatureImport(signatureDER);
                    const sig = utils_1.hexlify(signature);
                    return mxw_sdk_js_1.mxw.utils.serializeTransaction(tx, sig, this._addressAndPubKey.compressed_pk);
                });
            });
            _pending = signPromise;
            return signPromise;
        });
    }
    sendTransaction(transaction, overrides) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        return transaction_1.populateTransaction(transaction, this.provider, this.address).then((tx) => {
            return this.sign(tx, overrides).then((signedTransaction) => {
                return this.provider.sendTransaction(signedTransaction, overrides).catch(error => {
                    // Clear the cached nonce when failure happened to prevent it out of sequence
                    this.clearNonce();
                    throw error;
                });
            });
        });
    }
    signMessage(message) {
        /* currently sign only support kyc, and transaction with chain_id, fee etc  */
        let signPromise = _pending.then(() => {
            let msg = ((typeof (message) === 'string') ? message : utils_1.toUtf8String(message));
            return this._mxw.sign(this.path, msg).then((signatureResponse) => {
                if (signatureResponse.return_code !== 0x9000) {
                    mxw_sdk_js_1.errors.throwError(signatureResponse.error_message, mxw_sdk_js_1.errors.INVALID_ARGUMENT, { argument: message });
                }
                const signatureDER = signatureResponse.signature;
                const signature = secp256k1_1.signatureImport(signatureDER);
                const sig = utils_1.hexlify(signature);
                return Promise.resolve(sig);
            });
        });
        _pending = signPromise;
        return signPromise;
    }
    getBalance(blockTag) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        let promise = _pending.then(() => {
            return this.provider.getBalance(this.address, blockTag);
        });
        _pending = promise;
        return promise;
    }
    getAccountNumber(blockTag) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        if (!this.accountNumber) {
            let promise = _pending.then(() => {
                return this.provider.getAccountNumber(this.address, blockTag).then((accountNumber) => {
                    this.accountNumber = accountNumber;
                    return Promise.resolve(this.accountNumber);
                });
            });
            return promise;
        }
        return Promise.resolve(this.accountNumber);
    }
    getTransactionCount(blockTag) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        let promise = _pending.then(() => {
            return this.provider.getTransactionCount(this.address, blockTag);
        });
        _pending = promise;
        return promise;
    }
    transfer(addressOrName, value, overrides) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        if (addressOrName instanceof Promise) {
            let addressPromise = _pending.then(() => {
                return addressOrName.then((address) => {
                    return this.transfer(address, value, overrides);
                });
            });
            _pending = addressPromise;
            return addressPromise;
        }
        return this.resolveName(addressOrName).then((address) => {
            let transaction = this.provider.getTransactionRequest("bank", "bank-send", {
                from: this.address,
                to: address,
                value: value,
                memo: (overrides && overrides.memo) ? overrides.memo : "",
                denom: (overrides && overrides.denom) ? overrides.denom : units_1.smallestUnitName
            });
            transaction.fee = (overrides && overrides.fee) ? overrides.fee : this.provider.getTransactionFee(undefined, undefined, { tx: transaction });
            return this.sendTransaction(transaction, overrides).then((response) => {
                if (overrides && overrides.sendOnly) {
                    return response;
                }
                let confirmations = (overrides && overrides.confirmations) ? Number(overrides.confirmations) : null;
                return this.provider.waitForTransaction(response.hash, confirmations).then((receipt) => {
                    if (1 == receipt.status) {
                        return receipt;
                    }
                    return mxw_sdk_js_1.errors.throwError("transfer failed", mxw_sdk_js_1.errors.CALL_EXCEPTION, {
                        method: "mxw/msgSend",
                        response: response,
                        receipt: receipt
                    });
                });
            });
        });
    }
    isWhitelisted(blockTag) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        let promise = _pending.then(() => {
            return this.provider.isWhitelisted(this.address, blockTag);
        });
        _pending = promise;
        return promise;
    }
    getKycAddress(blockTag) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        let promise = _pending.then(() => {
            return this.provider.getKycAddress(this.address, blockTag);
        });
        _pending = promise;
        return promise;
    }
    createAlias(name, appFee, overrides) {
        if (!this.provider) {
            mxw_sdk_js_1.errors.throwError('missing provider', mxw_sdk_js_1.errors.NOT_INITIALIZED, { argument: 'provider' });
        }
        utils_1.checkProperties(appFee, {
            to: true,
            value: true
        }, true);
        if (utils_1.bigNumberify(appFee.value).lte(0)) {
            mxw_sdk_js_1.errors.throwError('create alias transaction require non-zero application fee', mxw_sdk_js_1.errors.MISSING_FEES, { value: appFee });
        }
        let promise = _pending.then(() => {
            return utils_1.resolveProperties({ name: name }).then(({ name }) => {
                let transaction = this.provider.getTransactionRequest("nameservice", "nameservice-createAlias", {
                    appFeeTo: appFee.to,
                    appFeeValue: appFee.value.toString(),
                    name,
                    owner: this.address,
                    memo: (overrides && overrides.memo) ? overrides.memo : ""
                });
                transaction.fee = this.provider.getTransactionFee(undefined, undefined, { tx: transaction });
                return this.sendTransaction(transaction, overrides).then((response) => {
                    if (overrides && overrides.sendOnly) {
                        return response;
                    }
                    let confirmations = (overrides && overrides.confirmations) ? Number(overrides.confirmations) : null;
                    return this.provider.waitForTransaction(response.hash, confirmations).then((receipt) => {
                        if (1 == receipt.status) {
                            return receipt;
                        }
                        return mxw_sdk_js_1.errors.throwError("create alias failed", mxw_sdk_js_1.errors.CALL_EXCEPTION, {
                            method: "nameservice/createAlias",
                            response: response,
                            receipt: receipt
                        });
                    });
                });
            });
        });
        _pending = promise;
        return promise;
    }
    connect(provider) {
        return new LedgerSigner(this._transport, provider);
    }
    clearNonce() {
        this.nonce = undefined;
    }
    getCompressedPublicKey() {
        let promise = _pending.then(() => {
            return this._addressAndPubKey.compressed_pk;
        });
        _pending = promise;
        return promise;
    }
    getHexAddress() {
        let promise = _pending.then(() => {
            return utils_1.computeHexAddress(this._addressAndPubKey.bech32_address);
        });
        _pending = promise;
        return promise;
    }
    getPublicKeyType() {
        return Promise.resolve("PubKeySecp256k1");
    }
    getAddressAndPubKey() {
        let addressPromise = _pending.then(() => {
            return this._mxw.showAddressAndPubKey(this.path, hrp).then((result) => {
                this._addressAndPubKey = result;
                return result;
            });
        });
        _pending = addressPromise;
        return Promise.resolve(addressPromise);
    }
    resolveName(addressOrName) {
        let promise = _pending.then(() => {
            return this.provider.resolveName(addressOrName);
        });
        _pending = promise;
        return promise;
    }
    static connect(transport, provider, options) {
        return transport.create().then((t) => {
            return new LedgerSigner(t, provider, options);
        });
    }
}
exports.LedgerSigner = LedgerSigner;
