import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { SystemMessageService } from '../../services/SystemMessageService.js';
import { logger } from '../../utils/logger.js';

export default {
    accessLevel: 4, // Nível 4: Apenas Fundadores/Administradores
    data: new SlashCommandBuilder()
        .setName('setup-comunidade')
        .setDescription('Monta toda a estrutura de canais, categorias, cargos e regras do servidor automaticamente.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
        
    async execute(interaction) {
        await interaction.reply({ content: '⏳ Iniciando a montagem do servidor. Isso pode levar alguns segundos...', flags: 64 }); // Resposta efêmera
        
        try {
            await SystemMessageService.setupCommunity(interaction.guild);
            await interaction.editReply({ content: '✅ Setup da comunidade concluído com sucesso! Verifique os novos canais, categorias e permissões do servidor.' });
        } catch (error) {
            logger.error(`Erro no comando de setup-comunidade: ${error.message}`);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao montar o servidor. Verifique se o meu cargo está no topo da lista de cargos!' });
        }
    }
};