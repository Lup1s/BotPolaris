import { SlashCommandBuilder } from 'discord.js';
import { LevelingService } from '../../services/LevelingService.js';

export const data = new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o top 10 do servidor em experiência militar.');

export async function execute(interaction) {
    await interaction.deferReply();
    try {
        const embed = await LevelingService.generateRankingEmbed(interaction.guild);
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: 'Ocorreu um erro ao carregar o ranking.', flags: 64 });
    }
}