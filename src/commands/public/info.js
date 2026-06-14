import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Mostra informações sobre o BotPolaris.'),
    accessLevel: 1,
    cooldown: 5,
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('BotPolaris - Assistente Oficial')
            .setDescription('Sistema avançado de administração de servidores Discord e automação inteligente.')
            .addFields(
                { name: 'Versão', value: '1.0.0', inline: true },
                { name: 'Node.js', value: process.version, inline: true },
                { name: 'Discord.js', value: 'v14', inline: true }
            )
            .setFooter({ text: 'Desenvolvido com arquitetura moderna e segura.' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
