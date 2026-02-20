declare module 'nodemailer' {
    export interface SendMailOptions {
        from?: string;
        to?: string;
        subject?: string;
        html?: string;
        text?: string;
        messageId?: string;
        headers?: Record<string, string>;
    }

    export interface SendMailResult {
        messageId: string;
    }

    export interface Transporter {
        verify(): Promise<void>;
        sendMail(options: SendMailOptions): Promise<SendMailResult>;
    }

    const nodemailer: {
        createTransport(options: Record<string, unknown>): Transporter;
    };

    export default nodemailer;
}
