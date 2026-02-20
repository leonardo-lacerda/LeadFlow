import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { decryptSecret } from '../lib/secrets.js';
import { emailService } from '../modules/email/email.service.js';

let polling = false;
let timer: NodeJS.Timeout | null = null;

async function pollMailbox(mailbox: {
    id: string;
    organizationId: string;
    imapHost: string | null;
    imapPort: number | null;
    imapUser: string | null;
    imapPass: string | null;
}) {
    if (!mailbox.imapHost || !mailbox.imapUser || !mailbox.imapPass) {
        return;
    }

    const client = new ImapFlow({
        host: mailbox.imapHost,
        port: mailbox.imapPort || 993,
        secure: (mailbox.imapPort || 993) === 993,
        auth: {
            user: mailbox.imapUser,
            pass: decryptSecret(mailbox.imapPass) || mailbox.imapPass,
        },
    });

    await client.connect();
    try {
        await client.mailboxOpen('INBOX');
        const uids = await client.search({ seen: false });
        if (!uids || uids.length === 0) {
            return;
        }
        for (const uid of uids) {
            const message = await client.fetchOne(uid, { source: true, envelope: true });
            if (!message || !message.source) {
                continue;
            }
            const parsed = await simpleParser(message.source as Buffer);
            const from = parsed.from?.value?.[0]?.address;
            if (from) {
                await emailService.processInbound(
                    { id: mailbox.id, organizationId: mailbox.organizationId },
                    from,
                    parsed.subject || '',
                    parsed.text || parsed.html?.toString() || ''
                );
            }
            await client.messageFlagsAdd(uid, ['\\Seen']);
        }
    } finally {
        await client.logout();
    }
}

async function pollImap() {
    const mailboxes = await prisma.mailbox.findMany({
        where: {
            isActive: true,
            imapHost: { not: null },
            imapUser: { not: null },
            imapPass: { not: null },
        },
        select: {
            id: true,
            organizationId: true,
            imapHost: true,
            imapPort: true,
            imapUser: true,
            imapPass: true,
        },
    });

    for (const mailbox of mailboxes) {
        try {
            await pollMailbox(mailbox);
        } catch (error) {
            console.warn('IMAP polling failed:', error);
        }
    }
}

export function startImapPolling() {
    if (timer) {
        return;
    }

    const interval = env.IMAP_POLL_INTERVAL;
    void pollImap();
    timer = setInterval(async () => {
        if (polling) {
            return;
        }
        polling = true;
        try {
            await pollImap();
        } finally {
            polling = false;
        }
    }, interval);
}
