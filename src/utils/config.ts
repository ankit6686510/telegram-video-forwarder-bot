import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

// Export for use in other files if needed
export function getEnvVariable(key: string, required: boolean = true): string {
    const value = process.env[key];
    if (required && !value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value || '';
}

export const config: Config = {
    apiId: parseInt(getEnvVariable('API_ID'), 10),
    apiHash: getEnvVariable('API_HASH'),
    phoneNumber: getEnvVariable('PHONE_NUMBER'),
    sessionName: getEnvVariable('SESSION_NAME', false) || 'telegram_forwarder',
    sessionString: getEnvVariable('SESSION_STRING', false),
    sourceChatId: getEnvVariable('SOURCE_CHAT_ID', false),
    targetChatId: getEnvVariable('TARGET_CHAT_ID', false),
    concurrentDownloads: parseInt(getEnvVariable('CONCURRENT_DOWNLOADS', false) || '5', 10),
    logLevel: getEnvVariable('LOG_LEVEL', false) || 'info',
};

// Validate API ID
if (isNaN(config.apiId)) {
    throw new Error('API_ID must be a valid number');
}
