import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { LevelingService } from '../../services/LevelingService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Mostra o Top 10 membros com mais XP no servidor.'),
    accessLevel: 1,
    cooldown: 10,
    async execute(interaction) {
        await interaction.deferReply();

        const allUsers = Array.from(LevelingService.usersData.entries())
            .map(([id, info]) => ({ id, level: info.level, xp: info.xp, voice: info.voiceTimeMinutes || 0 }))
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10);

        if (allUsers.length === 0) {
            return interaction.editReply('Ainda não há dados no ranking.');
        }

        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('🏆 Ranking Militar de XP')
            .setDescription('Os operativos mais dedicados do servidor.');

        let rankText = '';
        for (let i = 0; i < allUsers.length; i++) {
            const u = allUsers[i];
            const member = await interaction.guild.members.fetch(u.id).catch(() => null);
            const name = member ? member.user.username : `Desconhecido (${u.id})`;
            
            let rankMedal = '🏅';
            if (i === 0) rankMedal = '🥇';
            if (i === 1) rankMedal = '🥈';
            if (i === 2) rankMedal = '🥉';

            rankText += `${rankMedal} **#${i + 1}** ${name}\n`;
            rankText += `└ Nvl **${u.level}** | **${u.xp}** XP | 🎤 **${u.voice}** min\n\n`;
        }

        embed.addFields({ name: 'Top 10', value: rankText });

        await interaction.editReply({ embeds: [embed] });
    },
};