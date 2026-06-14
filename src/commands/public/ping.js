import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Retorna a latência atual do bot e da API do Discord.'),
    accessLevel: 1, // Usuários comuns
    cooldown: 5,
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true, ephemeral: true });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        await interaction.editReply(`🏓 Pong!\nLatência do Bot: \`${latency}ms\`\nLatência da API: \`${apiLatency}ms\``);
    },
};
