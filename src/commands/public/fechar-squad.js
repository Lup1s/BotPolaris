import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('fechar-squad')
    .setDescription('Fecha um squad ativo.');

export async function execute(interaction) {
    await interaction.reply({ content: 'Comando fechar-squad em desenvolvimento.', flags: 64 });
}