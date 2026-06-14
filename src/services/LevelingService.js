import { supabase } from '../database/supabase.js';
import { logger } from '../utils/logger.js';
import { PermissionsBitField } from 'discord.js';

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
                        voiceTimeMinutes: row.voice_time_minutes
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
                voice_time_minutes: info.voiceTimeMinutes
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

    static getUserData(userId) {
        if (!this.usersData.has(userId)) {
            this.usersData.set(userId, { xp: 0, level: 1, lastMessage: 0, voiceTimeMinutes: 0 });
        }
        return this.usersData.get(userId);
    }

    static async addMessageXp(message) {
        if (message.author.bot) return;

        const userId = message.author.id;
        const now = Date.now();
        const data = this.getUserData(userId);

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
            data.level++;
            logger.info(`Usuário ${member.user.tag} subiu para o nível ${data.level}.`);
            
            if (channel) {
                channel.send(`🎖️ Parabéns, ${member.toString()}! Você foi promovido para o Nível **${data.level}**!`).catch(() => {});
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
                        reason: 'Criação automática de patente militar.'
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
}