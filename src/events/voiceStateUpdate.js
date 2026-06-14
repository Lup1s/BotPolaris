import { Events } from 'discord.js';
import { TempVoiceService } from '../services/TempVoiceService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        try {
            await TempVoiceService.handleVoiceStateUpdate(oldState, newState);
        } catch (error) {
            logger.error(`Erro no evento voiceStateUpdate: ${error.message}`);
        }
    },
};