import { Events } from 'discord.js';
import { SystemMessageService } from '../services/SystemMessageService.js';
import { TempVoiceService } from '../services/TempVoiceService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild) return;

        try {
            // Se o bot deletar ou alguém deletar a mensagem de LFG, fecha a call atrelada
            const embed = message.embeds[0];
            if (embed && embed.footer?.text && embed.footer.text.includes('Canal ID:')) {
                const match = embed.footer.text.match(/Canal ID: (\d+)/);
                if (match) {
                    const channelId = match[1];
                    const voiceChannel = message.guild.channels.cache.get(channelId);
                    if (voiceChannel && TempVoiceService.isTempChannel(channelId)) {
                        await TempVoiceService.closeSquad(voiceChannel, message.guild, 'Mensagem de LFG foi excluída.').catch(() => {});
                    }
                }
            }

            // Se for uma mensagem do bot, verificar se era uma mensagem estática de sistema
            if (message.author?.id === message.client.user.id) {
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
            }
        } catch (error) {
            logger.error(`Erro no evento MessageDelete: ${error.message}`);
        }
    },
};