import { ChannelType } from 'discord.js';
import { logger } from '../utils/logger.js';

export class StatsService {
    static async updateStatsChannels(guild) {
        try {
            await guild.members.fetch();
            
            const totalMembers = guild.memberCount;
            const onlineMembers = guild.members.cache.filter(m => ['online', 'idle', 'dnd'].includes(m.presence?.status)).size;
            
            let inVoice = 0;
            let playingGames = 0;

            for (const member of guild.members.cache.values()) {
                if (member.voice.channel) inVoice++;
                if (member.presence?.activities.some(a => a.type === 0)) playingGames++; // type 0 = Playing
            }

            const categoryName = '📊 ESTATÍSTICAS';
            let category = guild.channels.cache.find(c => c.name === categoryName && c.type === ChannelType.GuildCategory);
            
            if (!category) {
                category = await guild.channels.create({ 
                    name: categoryName, 
                    type: ChannelType.GuildCategory,
                    position: 0 
                });
            }

            const stats = [
                { name: `👥 Membros: ${totalMembers}`, id: 'stats_members' },
                { name: `🟢 Online: ${onlineMembers}`, id: 'stats_online' },
                { name: `🎮 Jogando: ${playingGames}`, id: 'stats_playing' },
                { name: `🎤 Em Call: ${inVoice}`, id: 'stats_voice' }
            ];

            for (const stat of stats) {
                // Procura canais com prefixo similar
                const prefix = stat.name.split(':')[0]; // ex: "👥 Membros"
                let channel = guild.channels.cache.find(c => c.parentId === category.id && c.name.startsWith(prefix) && c.type === ChannelType.GuildVoice);
                
                if (channel) {
                    if (channel.name !== stat.name) {
                        await channel.setName(stat.name).catch(()=>{});
                    }
                } else {
                    await guild.channels.create({
                        name: stat.name,
                        type: ChannelType.GuildVoice,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: ['Connect'] // Ninguém pode conectar, é só pra exibir
                            }
                        ]
                    });
                }
            }
        } catch (error) {
            logger.error(`Erro ao atualizar canais de estatísticas: ${error.message}`);
        }
    }

    static startAutoUpdate(client) {
        // Atualiza a cada 5 minutos
        setInterval(() => {
            for (const guild of client.guilds.cache.values()) {
                this.updateStatsChannels(guild);
            }
        }, 5 * 60 * 1000);
    }
}