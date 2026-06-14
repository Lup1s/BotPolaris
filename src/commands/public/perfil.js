import { SlashCommandBuilder } from 'discord.js';
import { LevelingService } from '../../services/LevelingService.js';

export const data = new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra o perfil militar e estatísticas do usuário.');

export async function execute(interaction) {
    await interaction.deferReply();
    try {
        const embed = await LevelingService.generateProfileEmbed(interaction.member);
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: 'Ocorreu um erro ao carregar seu perfil.', flags: 64 });
    }
}