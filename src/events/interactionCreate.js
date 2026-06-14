import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { checkAuth } from '../middleware/auth.js';
import { checkCooldown } from '../middleware/cooldown.js';
import { SystemMessageService } from '../services/SystemMessageService.js';
import { TicketService } from '../services/TicketService.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Intercepta Componentes (Botões e Selects) para os serviços
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            try {
                await SystemMessageService.handleInteraction(interaction);
                await TicketService.handleInteraction(interaction);
            } catch (err) {
                logger.error(`Erro ao processar componente: ${err.message}`);
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            logger.warn(`Comando não encontrado: ${interaction.commandName}`);
            return;
        }

        // Middleware de Autenticação e Segurança
        if (!checkAuth(interaction, command)) {
            return;
        }

        // Middleware de Cooldown
        if (!checkCooldown(interaction, command)) {
            return;
        }

        try {
            logger.info(`Usuário ${interaction.user.tag} executou /${interaction.commandName}`);
            await command.execute(interaction);
        } catch (error) {
            logger.error(`Erro ao executar ${interaction.commandName}: ${error.message}`);
            
            const replyContent = 'Ocorreu um erro ao executar este comando!';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: replyContent, flags: 64 });
            } else {
                await interaction.reply({ content: replyContent, flags: 64 });
            }
        }
    },
};
