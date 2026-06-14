import { Events } from 'discord.js';
import { SystemMessageService } from '../services/SystemMessageService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            await SystemMessageService.handleMemberJoin(member);
        } catch (error) {
            logger.error(`Erro no evento guildMemberAdd: ${error.message}`);
        }
    },
};