
import { mxw, Signer, errors } from 'mxw-sdk-js';
import { default as CosmosApp } from 'ledger-cosmos-js';

import { computeHexAddress, BigNumber, shallowCopy, Arrayish, resolveProperties, iterate, BigNumberish } from 'mxw-sdk-js/dist/utils';
import { Provider, TransactionRequest, TransactionResponse, BlockTag, TransactionReceipt } from 'mxw-sdk-js/dist/providers';
import { signatureImport } from 'secp256k1';
import { sortObject } from 'mxw-sdk-js/dist/utils/misc';
import { populateTransaction } from 'mxw-sdk-js/dist/utils/transaction';
import { smallestUnitName } from 'mxw-sdk-js/dist/utils/units';

export type Options = {
    path?: string
}

const hrp = "mxw";
const HardenedBit = 0x80000000;

function getPathArray(path: string) {
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
let _pending: Promise<any> = Promise.resolve(null);

export class LedgerSigner extends Signer {
    readonly path: string;

    private _config: string;
    private _transport: any;
    private _mxw: CosmosApp;

    private _ready: Promise<void>

    private _addressAndPubKey: any;

    private address: string;
    private accountNumber: BigNumber;


    constructor(transport: any, provider: Provider, options?: Options) {
        super();

        if (!options) { options = { }; }
        if (!options.path) { options.path = mxw.utils.HDNode.defaultPath; };

        if(typeof (options.path ) === 'string'){
            mxw.utils.defineReadOnly(this, 'path', getPathArray(options.path));        
        }else if (Array.isArray(options.path)) {
            mxw.utils.defineReadOnly(this, 'path', options.path);
        }

        mxw.utils.defineReadOnly(this, 'provider', provider);       
        mxw.utils.defineReadOnly(this, '_transport', transport);
        mxw.utils.defineReadOnly(this, '_mxw', new CosmosApp(transport));

        this._ready = this.getAddressAndPubKey().then((result: any) => {
            this._addressAndPubKey = result;
            this.address = this._addressAndPubKey.bech32_address;
        });

        _pending = this._ready;

        this._config = JSON.stringify(null);
    }

    get config(): any {
        return JSON.parse(this._config);
    }

    getConfig(): Promise<any> {
        return _pending.then(() => {
            return this._mxw.getVersion();
        });
    }

    getAddress(): Promise<string> {
      let promise = _pending.then(()=>{
        return this._addressAndPubKey.bech32_address;
      });
      _pending = promise;
      return promise;
    }

    sign(transaction: TransactionRequest, overrides?: any): Promise<string> {
            if (transaction.nonce == null || transaction.accountNumber == null) {
                transaction = shallowCopy(transaction);

                if (transaction.nonce == null) {
                    transaction.nonce = this.getTransactionCount("pending");
                }
                if (transaction.accountNumber == null) {
                    transaction.accountNumber = this.getAccountNumber();
                }
            }
            return resolveProperties(transaction).then((tx) => {
            if (!tx.nonce || !tx.accountNumber || !tx.value || !tx.value.msg || !Array.isArray(tx.value.msg)) {
                errors.throwError('missing transaction field', errors.MISSING_ARGUMENT, { argument: 'value', value: tx });
            }
            if (!Array.isArray(tx.value.msg)) {
                errors.throwError('invalid transaction field', errors.MISSING_ARGUMENT, { argument: 'value', value: tx });
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
            payload = iterate(payload, function (key, value, type) {
                switch (type) {
                    case "Number":
                    case "BigNumber":
                        return value.toString();
                }
                return value;
            });
            payload = sortObject(payload);

            // Log signature payload
            if (overrides && overrides.logSignaturePayload) {
                overrides.logSignaturePayload(payload);
            }
            let signPromise = _pending.then(() => {
                return this._mxw.sign(this.path, JSON.stringify(payload)).then((signatureResponse) => {
                    if(signatureResponse.return_code!== 0x9000){
                        errors.throwError(signatureResponse.error_message, errors.INVALID_ARGUMENT, { argument: transaction })
                    }
                    const signatureDER = signatureResponse.signature;
                    const signature = signatureImport(signatureDER);
                    const sig = '0x' + signature.toString("hex");
                    return mxw.utils.serializeTransaction(tx, sig, this._addressAndPubKey.compressed_pk);
                });
            });
            _pending = signPromise;
            return signPromise;
        });

    }

    sendTransaction(transaction: TransactionRequest, overrides?: any): Promise<TransactionResponse> {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }
            return populateTransaction(transaction, this.provider, this.address).then((tx) => {
                return this.sign(tx, overrides).then((signedTransaction) => {
                    console.log('signedTransaction', signedTransaction);
                    return this.provider.sendTransaction(signedTransaction, overrides).catch(error => {
                        // Clear the cached nonce when failure happened to prevent it out of sequence
                        this.clearNonce();
                        throw error;
                    });
                });
            });
    }

    signMessage(message: Arrayish | string): Promise<string> {
        //ledger signing required chain id etc parameter, thus sign message not implemented
        errors.throwError("not implemented", errors.NOT_IMPLEMENTED, { argument: message })
        return Promise.resolve("not implemented");
    }

    getBalance(blockTag?: BlockTag) {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }
        let promise = _pending.then(()=>{
            return this.provider.getBalance(this.address, blockTag);
        });

        _pending = promise;
        return promise;
    }

    getAccountNumber(blockTag?: BlockTag) {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }
        if (!this.accountNumber) {
            let promise = _pending.then(()=>{
                return this.provider.getAccountNumber(this.address, blockTag).then((accountNumber) => {
                    this.accountNumber = accountNumber;
                    return Promise.resolve(this.accountNumber);
                });
            });
            return promise;
        }
        return Promise.resolve(this.accountNumber);
    }

    getTransactionCount(blockTag?: BlockTag) {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }
        let promise = _pending.then(()=>{
            return this.provider.getTransactionCount(this.address, blockTag);
        });

        _pending = promise;
        return promise;
    }

    transfer(addressOrName: string | Promise<string>, value: BigNumberish, overrides?: any): Promise<TransactionResponse | TransactionReceipt> {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }
        
        if (addressOrName instanceof Promise) {
            let addressPromise = _pending.then(()=>{
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
                denom: (overrides && overrides.denom) ? overrides.denom : smallestUnitName
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
                    return errors.throwError("transfer failed", errors.CALL_EXCEPTION, {
                        method: "mxw/msgSend",
                        response: response,
                        receipt: receipt
                    });
                });
            });
        });
    }

    connect(provider: Provider) {
        return new LedgerSigner(this._transport, provider);
    }
    
    clearNonce() {
        this.nonce = undefined;
    }

    getCompressedPublicKey(){
        let promise = _pending.then(()=>{
            return this._addressAndPubKey.compressed_pk;
          });
          _pending = promise;
          return promise;
    }

    getHexAddress() {
        let promise = _pending.then(()=>{
            return computeHexAddress(this._addressAndPubKey.bech32_address);
          });
          _pending = promise;
          return promise;
    }

    getPublicKeyType() {
        return Promise.resolve("PubKeySecp256k1");
    }

    private getAddressAndPubKey() : Promise<any> {
        let addressPromise = _pending.then(() => {
            return this._mxw.getAddressAndPubKey(this.path, hrp).then((result: any)=>{
                this._addressAndPubKey = result;
                return result;
            });
        });
        _pending = addressPromise;
        return Promise.resolve(addressPromise);
    }

    private resolveName(addressOrName: string | Promise<string>): Promise<string>{
        let promise = _pending.then(()=>{
            return this.provider.resolveName(addressOrName);
        });
        _pending = promise;
        return promise;
    }


    static connect(transport: any, provider: Provider, options?: Options): Promise<LedgerSigner> {
        return transport.create().then((t: any) => {
            return new LedgerSigner(t, provider, options);
        });
    }
}
