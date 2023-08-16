import { mxw, Signer } from 'mxw-sdk-js';
import { Arrayish, BigNumberish } from 'mxw-sdk-js/dist/utils';
import { Provider, TransactionRequest, TransactionResponse, BlockTag, TransactionReceipt } from 'mxw-sdk-js/dist/providers';
export declare type Options = {
    path?: string;
};
export declare class LedgerSigner extends Signer {
    readonly path: string;
    private _config;
    private _transport;
    private _mxw;
    private _ready;
    private _addressAndPubKey;
    private address;
    private accountNumber;
    constructor(transport: any, provider: Provider, options?: Options);
    get config(): any;
    getConfig(): Promise<any>;
    getAddress(): Promise<string>;
    sign(transaction: TransactionRequest, overrides?: any): Promise<string>;
    sendTransaction(transaction: TransactionRequest, overrides?: any): Promise<TransactionResponse>;
    signMessage(message: Arrayish | string): Promise<string>;
    getBalance(blockTag?: BlockTag): Promise<mxw.utils.BigNumber>;
    getAccountNumber(blockTag?: BlockTag): Promise<mxw.utils.BigNumber>;
    getTransactionCount(blockTag?: BlockTag): Promise<mxw.utils.BigNumber>;
    transfer(addressOrName: string | Promise<string>, value: BigNumberish, overrides?: any): Promise<TransactionResponse | TransactionReceipt>;
    isWhitelisted(blockTag?: BlockTag): Promise<Boolean>;
    getKycAddress(blockTag?: BlockTag): Promise<string>;
    createAlias(name: string | Promise<string>, appFee: {
        to: string;
        value: BigNumberish;
    }, overrides?: any): Promise<TransactionResponse | TransactionReceipt>;
    connect(provider: Provider): LedgerSigner;
    clearNonce(): void;
    getCompressedPublicKey(): Promise<any>;
    getHexAddress(): Promise<string>;
    getPublicKeyType(): Promise<string>;
    private getAddressAndPubKey;
    private resolveName;
    static connect(transport: any, provider: Provider, options?: Options): Promise<LedgerSigner>;
}
