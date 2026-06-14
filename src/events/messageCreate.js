import { Events } from 'discord.js';
import { LevelingService } from '../services/LevelingService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.MessageCreate,
    async execute(message) {
        if (!message.guild || message.author.bot) return;

        try {
            await LevelingService.addMessageXp(message);
        } catch (error) {
            logger.error(`Erro no evento MessageCreate (XP): ${error.message}`);
        }
    },
};