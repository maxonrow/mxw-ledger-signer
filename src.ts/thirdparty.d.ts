import Transport from "@ledgerhq/hw-transport"

declare module "ledger-mxw-js" {

    export type SignatureResponse = {
        return_code: number,
        error_message: string,
        // ///
        signature: Buffer,
    }

    export type AppVersion = {
        return_code: number,
        error_message: string,
        // ///
        test_mode: boolean,
        major: number,
        minor: number,
        patch: number,
        device_locked: boolean,
        target_id: string
    }

    export type AppInfo = {
        return_code: number,
        error_message: string,
        appName: string,
        appVersion: string,
        flagLen: number,
        flagsValue: number,
        flag_recovery: boolean,
        flag_signed_mcu_code: boolean,
        flag_onboarded: boolean,
        flag_pin_validated: boolean
    }

    export type AddressPubKey = {
        bech32_address: string,
        compressed_pk: any,
        return_code: number,
        error_message: string,
    }

    export default class CosmosApp {
        constructor(transport: Transport);
        getVersion(): Promise<AppVersion>;
        appInfo(): Promise<AppInfo>;
        getAddressAndPubKey(path:Array<number>, hrp: string): Promise<AddressPubKey>;
        showAddressAndPubKey(path: Array<number>, hrp: string): Promise<AddressPubKey>;
        sign(path: Array<number>, unsignedTx: Buffer, hrp: string | undefined): Promise<SignatureResponse>;
    }

    //export  CosmosApp;
}
/*
declare module "@ledgerhq/hw-transport-node-hid" {
    export class Transport { }
    export function create(): Promise<Transport>;
}

declare module "@ledgerhq/hw-transport-u2f" {
    export class Transport { }
    export function create(): Promise<Transport>;
}
*/
