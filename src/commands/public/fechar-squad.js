import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('fechar-squad')
    .setDescription('Fecha um squad ativo.');

async function execute(interaction) {
    await interaction.reply({ content: 'Comando fechar-squad em desenvolvimento.', flags: 64 });
}

export default { data, execute };