import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { LevelingService } from '../../services/LevelingService.js';
import { SystemMessageService } from '../../services/SystemMessageService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Veja o seu perfil militar, XP e estatísticas.')
        .addUserOption(opt => opt.setName('usuario').setDescription('Ver o perfil de outro membro').setRequired(false)),
    accessLevel: 1,
    cooldown: 5,
    async execute(interaction) {
        const target = interaction.options.getMember('usuario') || interaction.member;
        
        if (target.user.bot) {
            return interaction.reply({ content: 'Bots não possuem perfil militar.', flags: 64 });
        }

        const data = LevelingService.getUserData(target.id);
        
        let currentRank = LevelingService.ranks[0];
        let nextRank = null;

        for (let i = 0; i < LevelingService.ranks.length; i++) {
            if (data.level >= LevelingService.ranks[i].level) {
                currentRank = LevelingService.ranks[i];
                nextRank = LevelingService.ranks[i + 1] || null;
            }
        }

        const reqXp = LevelingService.getRequiredXp(data.level);
        const percent = Math.min(100, Math.floor((data.xp / reqXp) * 100));

        // Pegar ranking
        const allUsers = Array.from(LevelingService.usersData.entries())
            .map(([id, info]) => ({ id, xp: info.xp }))
            .sort((a, b) => b.xp - a.xp);
        
        const rankPos = allUsers.findIndex(u => u.id === target.id) + 1;

        // Pegar jogos
        const rolesToManage = ['CS2', 'Valorant', 'Rainbow Six', 'Fortnite', 'Minecraft'];
        const jogos = target.roles.cache.filter(r => rolesToManage.includes(r.name)).map(r => r.name);

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setAuthor({ name: `Perfil de ${target.user.username}`, iconURL: target.user.displayAvatarURL() })
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🎖️ Patente Atual', value: `${currentRank.name} (Nvl ${data.level})`, inline: true },
                { name: '🏆 Posição', value: `#${rankPos > 0 ? rankPos : '?'} no Ranking`, inline: true },
                { name: '📈 Progresso (XP)', value: `${data.xp} / ${reqXp} (${percent}%)`, inline: true },
                { name: '🎤 Tempo em Voice', value: `${data.voiceTimeMinutes || 0} minutos`, inline: true },
                { name: '🎮 Jogos', value: jogos.length > 0 ? jogos.join(', ') : 'Nenhum', inline: true }
            );

        if (nextRank) {
            embed.setFooter({ text: `Próxima Patente: ${nextRank.name} (Nvl ${nextRank.level})` });
        } else {
            embed.setFooter({ text: 'Patente Máxima Atingida!' });
        }

        await interaction.reply({ embeds: [embed] });
    },
};