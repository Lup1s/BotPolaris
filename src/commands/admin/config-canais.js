import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { SystemMessageService } from '../../services/SystemMessageService.js';
import { logger } from '../../utils/logger.js';

export default {
    accessLevel: 3, // Administradores
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('config-canais')
        .setDescription('[ADMIN] Reconfigura permissões e painéis dos canais de informações existentes.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
        
    async execute(interaction) {
        await interaction.reply({ content: '⏳ Iniciando reconfiguração de canais existentes e permissões...', flags: 64 });
        
        try {
            await SystemMessageService.configureExistingChannels(interaction.guild);
            await interaction.editReply({ content: '✅ Canais existentes reconfigurados com sucesso! As permissões de leitura/escrita foram ajustadas e o painel de regras foi gerado.' });
        } catch (error) {
            logger.error(`Erro ao reconfigurar canais: ${error.message}`);
            await interaction.editReply({ content: `❌ Houve um erro ao reconfigurar canais: ${error.message}. Verifique se o meu cargo está no topo da hierarquia!` });
        }
    }
};
