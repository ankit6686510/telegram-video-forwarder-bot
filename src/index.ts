import { initializeClient } from './client';
import { registerMessageHandler } from './handlers/messageHandler';
import { registerCommandHandler } from './handlers/commandHandler';
import { logger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    try {
        logger.info('Starting Telegram Video Forwarder...');

        // Ensure logs directory exists
        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Initialize Telegram client
        await initializeClient();

        // Register event handlers
        registerMessageHandler();
        registerCommandHandler();

        logger.info('Bot is now running! Press Ctrl+C to stop.');
        logger.info('Send /start to yourself on Telegram to see available commands.');

        // Keep the process running
        process.on('SIGINT', async () => {
            logger.info('Shutting down gracefully...');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Shutting down gracefully...');
            process.exit(0);
        });
    } catch (error) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
}

main();
