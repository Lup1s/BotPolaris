import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { ChannelType, PermissionsBitField } from 'discord.js';
import { logger } from '../utils/logger.js';

export class TempVoiceService {
    static dbPath = path.resolve('src', 'database', 'temp_channels.json');
    static activeChannels = new Map();
    static createChannelNames = ['➕ Criar Call', 'Criar Call', '➕ criar call', 'criar call'];

    static async init(client) {
        try {
            // Garantir que a pasta database existe
            const dbDir = path.dirname(this.dbPath);
            if (!fsSync.existsSync(dbDir)) {
                fsSync.mkdirSync(dbDir, { recursive: true });
            }

            if (fsSync.existsSync(this.dbPath)) {
                const data = await fs.readFile(this.dbPath, 'utf8');
                const parsed = JSON.parse(data);
                for (const [channelId, ownerId] of Object.entries(parsed)) {
                    this.activeChannels.set(channelId, ownerId);
                }
            } else {
                await this.saveDb();
            }

            logger.info(`TempVoiceService iniciado. ${this.activeChannels.size} salas temporárias ativas no registro.`);
            
            // Limpeza de órfãos caso o bot tenha ficado offline
            this.cleanupOrphanedChannels(client);
        } catch (error) {
            logger.error(`Erro ao inicializar TempVoiceService: ${error.message}`);
        }
    }

    static async saveDb() {
        try {
            const data = Object.fromEntries(this.activeChannels);
            await fs.writeFile(this.dbPath, JSON.stringify(data, null, 4), 'utf8');
        } catch (error) {
            logger.error(`Erro ao salvar DB de temp channels: ${error.message}`);
        }
    }

    static async cleanupOrphanedChannels(client) {
        try {
            for (const [channelId, ownerId] of this.activeChannels) {
                // Procuramos o canal em todas as guildas
                const channel = client.channels.cache.get(channelId);
                if (!channel) {
                    // Canal não existe mais no Discord, limpa do banco
                    this.activeChannels.delete(channelId);
                    continue;
                }
                
                // Se o canal existir e estiver vazio
                if (channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
                    await channel.delete('Canal temporário vazio limpo na inicialização.');
                    this.activeChannels.delete(channelId);
                    logger.info(`Canal temporário órfão apagado: ${channelId}`);
                }
            }
            await this.saveDb();
        } catch (error) {
            logger.error(`Erro na limpeza de canais órfãos: ${error.message}`);
        }
    }

    static async handleVoiceStateUpdate(oldState, newState) {
        // Ignora se não houver mudança de canal (ex: apenas mutou o microfone)
        if (oldState.channelId === newState.channelId) return;

        const member = newState.member;
        if (!member) return;

        // 1. Lógica de SAIR de um canal
        if (oldState.channelId && this.activeChannels.has(oldState.channelId)) {
            const channel = oldState.channel;
            // Verifica se o canal ficou vazio
            if (channel && channel.members.size === 0) {
                try {
                    this.activeChannels.delete(oldState.channelId);
                    await this.saveDb();
                    await channel.delete('Último usuário saiu do canal temporário.');
                    logger.info(`Sala temporária ${channel.name} deletada.`);
                } catch (error) {
                    logger.error(`Erro ao deletar sala temporária ${oldState.channelId}: ${error.message}`);
                }
            }
        }

        // 2. Lógica de ENTRAR num canal "Criar Call"
        if (newState.channelId && newState.channel) {
            const isCreateChannel = this.createChannelNames.some(name => 
                newState.channel.name.toLowerCase() === name.toLowerCase()
            );

            if (isCreateChannel) {
                try {
                    await this.createTempChannel(member, newState.channel);
                } catch (error) {
                    logger.error(`Erro ao criar sala para ${member.user.tag}: ${error.message}`);
                    // Move o membro pra fora para não travar no canal de criação se der erro
                    if (member.voice.channelId) {
                        await member.voice.disconnect('Erro ao criar sala.').catch(() => {});
                    }
                }
            }
        }
    }

    static async createTempChannel(member, createChannel) {
        const guild = member.guild;
        const category = createChannel.parent; // Cria na mesma categoria do "Criar Call"

        // Nome padrão
        let channelName = `🎯 Squad de ${member.user.username}`;
        
        // Anti-spam básico: Verifica se já é dono de uma sala para evitar bugs
        for (const [channelId, ownerId] of this.activeChannels) {
            if (ownerId === member.id) {
                const existingChannel = guild.channels.cache.get(channelId);
                if (existingChannel) {
                    // Já tem sala, move pra ela
                    await member.voice.setChannel(existingChannel);
                    return;
                }
            }
        }

        const newChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: category ? category.id : null,
            permissionOverwrites: [
                {
                    id: guild.id, // Everyone
                    allow: [PermissionsBitField.Flags.Connect],
                },
                {
                    id: member.id, // Dono
                    allow: [
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.ManageRoles,
                        PermissionsBitField.Flags.MoveMembers,
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.Speak
                    ],
                }
            ],
            reason: `Criação de sala temporária para ${member.user.tag}`
        });

        // Registrar no banco
        this.activeChannels.set(newChannel.id, member.id);
        await this.saveDb();
        logger.info(`Sala temporária ${newChannel.id} criada para ${member.user.tag}.`);

        // Move o usuário para a nova sala
        await member.voice.setChannel(newChannel, 'Movendo para a sala temporária recém criada');
    }

    // Métodos para o Comando
    static isOwner(channelId, userId) {
        return this.activeChannels.get(channelId) === userId;
    }
    
    static isTempChannel(channelId) {
        return this.activeChannels.has(channelId);
    }
    
    static getOwner(channelId) {
        return this.activeChannels.get(channelId);
    }
}
