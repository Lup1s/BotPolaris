import { Events } from 'discord.js';
import { SystemMessageService } from '../services/SystemMessageService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        if (member.user.bot) return; // Ignora se quem entrou for outro bot

        try {
            await SystemMessageService.handleMemberJoin(member);
        } catch (error) {
            logger.error(`Erro no evento de boas-vindas (guildMemberAdd): ${error.message}`);
        }
    }
};