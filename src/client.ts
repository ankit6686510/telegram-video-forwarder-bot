import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
// @ts-ignore
import input from 'input';
import { config } from './utils/config';
import { logger } from './utils/logger';

let client: TelegramClient;

export async function initializeClient(): Promise<TelegramClient> {
    logger.info('Initializing Telegram client...');

    const stringSession = new StringSession(config.sessionString || '');

    client = new TelegramClient(
        stringSession,
        config.apiId,
        config.apiHash,
        {
            connectionRetries: 5,
        }
    );

    await client.start({
        phoneNumber: async () => {
            if (config.phoneNumber && config.phoneNumber !== '+1234567890') {
                return config.phoneNumber;
            }
            return await input.text('Please enter your phone number (e.g., +1234567890): ');
        },
        password: async () => await input.text('Please enter your 2FA password (if enabled): '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => {
            logger.error('Authentication error:', err);
            throw err;
        },
    });

    logger.info('Successfully connected to Telegram!');
    logger.info(`Session string: ${client.session.save()}`);
    logger.info('Save this session string to avoid logging in again.');

    return client;
}

export function getClient(): TelegramClient {
    if (!client) {
        throw new Error('Client not initialized. Call initializeClient() first.');
    }
    return client;
}
