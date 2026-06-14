import { SlashCommandBuilder } from 'discord.js';
import { SystemMessageService } from '../../services/SystemMessageService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup-server')
        .setDescription('Instala a estrutura completa de categorias, canais e mensagens estáticas na guilda atual.'),
    accessLevel: 5, // Apenas Owner
    cooldown: 60,
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        try {
            await SystemMessageService.setupCommunity(interaction.guild);
            await interaction.editReply('✅ Setup do Servidor finalizado! Canais, regras, tickets e o Fórum foram criados com sucesso.');
        } catch (error) {
            await interaction.editReply(`❌ Erro no setup: ${error.message}`);
        }
    },
};