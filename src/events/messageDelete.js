import { Events } from 'discord.js';
import { SystemMessageService } from '../services/SystemMessageService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild || message.author?.id !== message.client.user.id) return;

        try {
            // Se uma mensagem do bot foi apagada, verificar se era uma mensagem estática de sistema
            const config = SystemMessageService.config.messages;
            if (Object.values(config).includes(message.id)) {
                logger.info(`Mensagem de sistema apagada (${message.channel.name}). Recriando...`);
                
                if (message.id === config.regras) {
                    SystemMessageService.config.messages.regras = null;
                    await SystemMessageService.ensureRulesMessage(message.channel);
                } else if (message.id === config.escolha_jogos) {
                    SystemMessageService.config.messages.escolha_jogos = null;
                    await SystemMessageService.ensureGamesMessage(message.channel);
                } else if (message.id === config.tickets) {
                    SystemMessageService.config.messages.tickets = null;
                    await SystemMessageService.ensureTicketMessage(message.channel);
                }
            }
        } catch (error) {
            logger.error(`Erro no evento MessageDelete: ${error.message}`);
        }
    },
};