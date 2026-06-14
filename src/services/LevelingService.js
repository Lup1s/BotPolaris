import { supabase } from '../database/supabase.js';
import { logger } from '../utils/logger.js';
import { PermissionsBitField, EmbedBuilder } from 'discord.js';

export class LevelingService {
    static usersData = new Map();

    static ranks = [
        { level: 1, name: '🪖 Recruta', roleId: null },
        { level: 5, name: '🎖️ Soldado', roleId: null },
        { level: 10, name: '⚔️ Cabo', roleId: null },
        { level: 15, name: '🔰 Sargento', roleId: null },
        { level: 30, name: '⭐ Tenente', roleId: null },
        { level: 50, name: '🌟 Capitão', roleId: null },
        { level: 70, name: '💠 Major', roleId: null },
        { level: 80, name: '🔥 Coronel', roleId: null },
        { level: 90, name: '👑 General', roleId: null },
        { level: 100, name: '🏆 Marechal', roleId: null }
    ];

    static async init(client) {
        try {
            // Busca os dados do Supabase
            const { data, error } = await supabase.from('users_xp').select('*');
            if (error) throw error;

            if (data) {
                for (const row of data) {
                    this.usersData.set(row.user_id, {
                        xp: row.xp,
                        level: row.level,
                        lastMessage: Number(row.last_message),
                        voiceTimeMinutes: row.voice_time_minutes,
                        messageCount: row.message_count || 0,
                        prestige: row.prestige || 0,
                        reputationSum: row.reputation_sum || 5,
                        reputationVotes: row.reputation_votes || 1,
                        mixWins: row.mix_wins || 0,
                        mixLosses: row.mix_losses || 0,
                        lobbiesJoined: row.lobbies_joined || 0
                    });
                }
            }
            
            // Iniciar tracking de tempo em call
            this.startVoiceTracking(client);

            logger.info(`LevelingService iniciado com ${this.usersData.size} usuários carregados do Supabase.`);
        } catch (error) {
            logger.error(`Erro no LevelingService: ${error.message}`);
        }
    }

    static async saveDb() {
        try {
            if (this.usersData.size === 0) return;

            // Converte o Map para o formato que o Supabase espera (Snake Case)
            const records = Array.from(this.usersData.entries()).map(([userId, info]) => ({
                user_id: userId,
                xp: info.xp,
                level: info.level,
                last_message: info.lastMessage,
                voice_time_minutes: info.voiceTimeMinutes,
                message_count: info.messageCount,
                prestige: info.prestige || 0,
                reputation_sum: info.reputationSum || 5,
                reputation_votes: info.reputationVotes || 1,
                mix_wins: info.mixWins || 0,
                mix_losses: info.mixLosses || 0,
                lobbies_joined: info.lobbiesJoined || 0
            }));

            const { error } = await supabase.from('users_xp').upsert(records);
            if (error) throw error;
        } catch (error) {
            logger.error(`Erro ao salvar DB de XP no Supabase: ${error.message}`);
        }
    }

    static getRequiredXp(level) {
        return 100 * (level ** 2);
    }

    static getReputation(userId) {
        const data = this.getUserData(userId);
        return data.reputationVotes > 0 ? (data.reputationSum / data.reputationVotes) : 5.0;
    }

    static getUserData(userId) {
        if (!this.usersData.has(userId)) {
            this.usersData.set(userId, { 
                xp: 0, level: 1, lastMessage: 0, voiceTimeMinutes: 0, messageCount: 0, 
                prestige: 0, reputationSum: 5, reputationVotes: 1, mixWins: 0, mixLosses: 0, lobbiesJoined: 0 
            });
        }
        return this.usersData.get(userId);
    }
    
    // Retorna um valor numérico de "MMR" baseado no engajamento para balanceamento do Mix
    static getPlayerMmr(userId) {
        const data = this.getUserData(userId);
        return data.xp + (data.level * 100) + (data.mixWins * 50) - (data.mixLosses * 10);
    }

    static async addMessageXp(message) {
        if (message.author.bot) return;

        const userId = message.author.id;
        const now = Date.now();
        const data = this.getUserData(userId);
        
        data.messageCount = (data.messageCount || 0) + 1;

        // Cooldown de 60 segundos anti-farm para mensagens
        if (now - data.lastMessage < 60000) return;

        data.lastMessage = now;
        const xpToAdd = Math.floor(Math.random() * 11) + 15; // 15 a 25 XP
        data.xp += xpToAdd;

        await this.checkLevelUp(message.member, message.channel, data);
        await this.saveDb();
    }

    static startVoiceTracking(client) {
        setInterval(async () => {
            let updated = false;
            for (const guild of client.guilds.cache.values()) {
                for (const voiceState of guild.voiceStates.cache.values()) {
                    if (voiceState.member && !voiceState.member.user.bot) {
                        // Não dá XP se estiver mutado ou sozinho
                        if (voiceState.selfMute || voiceState.serverMute) continue;
                        if (voiceState.channel && voiceState.channel.members.size > 1) {
                            const data = this.getUserData(voiceState.member.id);
                            data.voiceTimeMinutes = (data.voiceTimeMinutes || 0) + 1;
                            data.xp += 5; // 5 XP por minuto em call
                            updated = true;
                            await this.checkLevelUp(voiceState.member, null, data);
                        }
                    }
                }
            }
            if (updated) await this.saveDb();
        }, 60000); // Roda a cada 1 minuto
    }

    static async checkLevelUp(member, channel, data) {
        const requiredXp = this.getRequiredXp(data.level);
        if (data.xp >= requiredXp) {
            if (data.level >= 100) {
                // Sistema de Prestígio
                data.prestige = (data.prestige || 0) + 1;
                data.level = 1; // Reseta para o nível 1
                data.xp = 0; // Reseta o XP
                if (channel) channel.send(`⭐ **PRESTÍGIO ALCANÇADO!** O Operador ${member.toString()} atingiu o Prestígio **${data.prestige}**!`).catch(() => {});
            } else {
                data.level++;
                logger.info(`Usuário ${member.user.tag} subiu para o nível ${data.level}.`);
            
                if (channel) {
                    channel.send(`🎖️ Parabéns, ${member.toString()}! Você foi promovido para o Nível **${data.level}**!`).catch(() => {});
                }
            }

            await this.updateMilitaryRole(member, data.level);
        }
    }

    static async updateMilitaryRole(member, level) {
        const guild = member.guild;
        
        let targetRank = this.ranks[0];
        for (const rank of this.ranks) {
            if (level >= rank.level) {
                targetRank = rank;
            } else {
                break;
            }
        }

        try {
            // Garantir que os cargos existam no servidor
            for (const rank of this.ranks) {
                let role = guild.roles.cache.find(r => r.name === rank.name);
                if (!role) {
                    role = await guild.roles.create({
                        name: rank.name,
                        color: 'Random',
                        reason: 'Criação automática de patente militar.',
                        hoist: true
                    });
                }
                rank.roleId = role.id;
            }

            // Remover patentes antigas e adicionar a nova
            const rankRoleIds = this.ranks.map(r => r.roleId);
            const rolesToRemove = member.roles.cache.filter(r => rankRoleIds.includes(r.id) && r.id !== targetRank.roleId);
            
            if (rolesToRemove.size > 0) {
                await member.roles.remove(rolesToRemove);
            }
            
            if (!member.roles.cache.has(targetRank.roleId)) {
                await member.roles.add(targetRank.roleId);
            }

        } catch (error) {
            logger.error(`Erro ao atualizar patente militar: ${error.message}`);
        }
    }

    // --- Métodos de Interface Visual (UI) ---

    static async generateProfileEmbed(member) {
        const data = this.getUserData(member.id);
        
        let currentRank = this.ranks[0];
        let nextRank = null;
        for (let i = 0; i < this.ranks.length; i++) {
            if (data.level >= this.ranks[i].level) {
                currentRank = this.ranks[i];
                nextRank = this.ranks[i + 1] || null;
            }
        }

        const reqXp = this.getRequiredXp(data.level);
        const percent = Math.min(100, Math.floor((data.xp / reqXp) * 100));

        const allUsers = Array.from(this.usersData.entries())
            .map(([id, info]) => ({ id, xp: info.xp }))
            .sort((a, b) => b.xp - a.xp);
        
        const rankPos = allUsers.findIndex(u => u.id === member.id) + 1;

        const rolesToManage = ['Jogador de CS2', 'Jogador de Valorant', 'Jogador de LoL', 'Jogador de Minecraft'];
        const jogos = member.roles.cache.filter(r => rolesToManage.includes(r.name)).map(r => r.name.replace('Jogador de ', ''));
        
        // Renderização Visual das Estrelas de Prestígio
        const prestigeStars = data.prestige > 0 ? '⭐'.repeat(Math.min(data.prestige, 5)) : 'Nenhum';
        const repValue = this.getReputation(member.id);
        const repStars = '⭐'.repeat(Math.round(repValue)) + ` (${repValue.toFixed(1)})`;
        const mixWinrate = (data.mixWins + data.mixLosses) > 0 ? Math.round((data.mixWins / (data.mixWins + data.mixLosses)) * 100) : 0;

        return new EmbedBuilder()
            .setColor('#a6e3a1')
            .setAuthor({ name: `Perfil Social: ${member.user.username}`, iconURL: member.user.displayAvatarURL() })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🎖️ Patente', value: `**${currentRank.name}** (Nvl ${data.level})`, inline: true },
                { name: '� Prestígio', value: prestigeStars, inline: true },
                { name: '� Posição', value: `#${rankPos > 0 ? rankPos : '?'} Geral`, inline: true },
                { name: '📈 Progresso', value: `\`[${'█'.repeat(Math.floor(percent/10))}${' '.repeat(10 - Math.floor(percent/10))}]\` ${percent}%`, inline: false },
                { name: '🎤 Tempo em Voice', value: `${data.voiceTimeMinutes || 0} min`, inline: true },
                { name: '🤝 Liderança', value: repStars, inline: true },
                { name: '🏆 Desempenho Mix', value: `${data.mixWins}V / ${data.mixLosses}D (${mixWinrate}% WR)`, inline: true },
                { name: '🎮 Lobbies / Jogos', value: `${data.lobbiesJoined} participações\n${jogos.length > 0 ? jogos.join(', ') : 'Nenhum'}`, inline: false }
            )
            .setFooter({ text: `ID Operacional: ${member.id} | Membro desde ${member.joinedAt.toLocaleDateString('pt-BR')}` });
    }

    static async generateRankingEmbed(guild) {
        const allUsers = Array.from(this.usersData.entries())
            .sort((a, b) => b[1].xp - a[1].xp).slice(0, 10);

        let rankText = '';
        for (let i = 0; i < allUsers.length; i++) {
            const [id, u] = allUsers[i];
            const member = await guild.members.fetch(id).catch(() => null);
            const name = member ? member.user.username : `Operador Desconhecido`;
            
            const rankMedal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
            rankText += `${rankMedal} **#${i + 1}** ${name}\n└ Nvl **${u.level}** | **${u.xp}** XP | 🎤 **${u.voiceTimeMinutes || 0}** min\n\n`;
        }

        return new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('🏆 Quadro de Honra Militar')
            .setDescription('Os operativos com maior engajamento na nossa base.')
            .addFields({ name: 'Top 10', value: rankText || 'Nenhum dado registrado.' });
    }

    static generateRanksEmbed() {
        const ranksList = this.ranks.map(r => `Nível ${r.level.toString().padStart(3, '0')} - **${r.name}**`).join('\n');
        return new EmbedBuilder()
            .setColor('#89b4fa')
            .setTitle('🎖️ Hierarquia Militar Polaris')
            .setDescription(`Suba de nível interagindo no servidor para desbloquear novas patentes:\n\n${ranksList}`);
    }
}