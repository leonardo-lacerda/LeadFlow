declare module 'mailparser' {
    export interface AddressObject {
        value?: Array<{
            address?: string;
            name?: string;
        }>;
    }

    export interface ParsedMail {
        from?: AddressObject;
        subject?: string;
        text?: string;
        html?: string | Buffer;
    }

    export function simpleParser(input: Buffer | string): Promise<ParsedMail>;
}
