import { supabase } from '../database/supabase.js';
import { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';

export class TempVoiceService {
    static activeChannels = new Map();
    static callSessions = new Map(); // Armazena dados de inteligência da sessão atual
    static createChannelNames = ['➕ Criar Squad', 'Criar Squad', '➕ criar call', 'criar call'];

    static async init(client) {
        try {
            const { data, error } = await supabase.from('temp_channels').select('*');
            if (error) throw error;

            if (data) {
                for (const row of data) {
                    this.activeChannels.set(row.channel_id, row.owner_id);
                }
            }

            logger.info(`TempVoiceService iniciado. ${this.activeChannels.size} salas temporárias ativas carregadas do Supabase.`);
            
            // Limpeza de órfãos caso o bot tenha ficado offline
            this.cleanupOrphanedChannels(client);
        } catch (error) {
            logger.error(`Erro ao inicializar TempVoiceService: ${error.message}`);
        }
    }

    static async saveDb() {
        try {
            if (this.activeChannels.size === 0) return;
            
            const records = Array.from(this.activeChannels.entries()).map(([channelId, ownerId]) => ({
                channel_id: channelId,
                owner_id: ownerId
            }));

            const { error } = await supabase.from('temp_channels').upsert(records);
            if (error) throw error;
        } catch (error) {
            logger.error(`Erro ao salvar DB de temp channels no Supabase: ${error.message}`);
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
                    await supabase.from('temp_channels').delete().eq('channel_id', channelId);
                    continue;
                }
                
                // Se o canal existir e estiver vazio
                if (channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
                    await channel.delete('Canal temporário vazio limpo na inicialização.');
                    
                    // Limpar também o canal de texto atrelado, se existir
                    const textChannel = channel.guild.channels.cache.find(c => c.topic === `LinkedVoice:${channelId}`);
                    if (textChannel) await textChannel.delete('Limpeza de órfãos.').catch(()=>{});

                    this.activeChannels.delete(channelId);
                    await supabase.from('temp_channels').delete().eq('channel_id', channelId);
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

        logger.debug(`[TempVoice] Movimentação: ${member.user.tag} | De: ${oldState.channelId || 'Nenhum'} Para: ${newState.channelId || 'Nenhum'}`);

        // 1. Lógica de SAIR de um canal
        if (oldState.channelId && this.activeChannels.has(oldState.channelId)) {
            const channel = oldState.channel;
            // Verifica se o canal ficou vazio
            if (channel && channel.members.size === 0) {
                await this.closeSquad(channel, oldState.guild, 'Último usuário saiu do canal temporário.');
            }
            
            // Se saiu mas a call não está vazia, apenas retira a permissão de ver o chat privado
            else if (channel && channel.members.size > 0) {
                const textChannel = oldState.guild.channels.cache.find(c => c.topic === `LinkedVoice:${oldState.channelId}`);
                if (textChannel) await textChannel.permissionOverwrites.delete(member.id).catch(()=>{});
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
            
            // Lógica para dar permissão no canal de texto caso entre em uma sala temporária já existente
            if (newState.channelId && this.activeChannels.has(newState.channelId)) {
                const textChannel = newState.guild.channels.cache.find(c => c.topic === `LinkedVoice:${newState.channelId}`);
                if (textChannel) await textChannel.permissionOverwrites.edit(member.id, { ViewChannel: true }).catch(()=>{});
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
        
        // Inicia o rastreamento inteligente da sessão
        this.callSessions.set(newChannel.id, {
            owner: member.id,
            startTime: Date.now(),
            participants: new Set([member.id]),
            name: channelName
        });

        // Cria o Chat Temporário atrelado
        try {
            const textChannel = await guild.channels.create({
                name: '💬・chat-squad',
                type: ChannelType.GuildText,
                parent: category ? category.id : null,
                topic: `LinkedVoice:${newChannel.id}`, // Chave de ligação
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // Esconde de todos
                    { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel] } // Mostra para o dono
                ]
            });
            
            // Injeta o Painel de Controle Operacional
            await this.sendCallDashboard(textChannel, member);
        } catch (error) {
            logger.warn(`Não foi possível criar o chat privado para o squad: ${error.message}`);
        }

        // Move o usuário para a nova sala
        await member.voice.setChannel(newChannel, 'Movendo para a sala temporária recém criada');
    }

    static async sendCallDashboard(textChannel, member) {
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🎛️ Terminal de Comando do Squad')
            .setDescription('Bem-vindo à base de operações. Apenas membros deste esquadrão possuem acesso a este chat temporário.\n\nGerencie sua call utilizando os botões abaixo.')
            .addFields({ name: 'Comandante', value: member.toString(), inline: true });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('call_lock').setLabel('Bloquear/Privar').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('call_unlock').setLabel('Tornar Pública').setStyle(ButtonStyle.Success).setEmoji('🌎'),
            new ButtonBuilder().setCustomId('call_transfer').setLabel('Transferir Liderança').setStyle(ButtonStyle.Primary).setEmoji('👑')
        );

        await textChannel.send({ content: member.toString(), embeds: [embed], components: [row1] });
    }

    static async generatePostActionReport(channelId, channelName, guild) {
        const session = this.callSessions.get(channelId);
        if (!session) return;

        const durationMs = Date.now() - session.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationHrs = Math.floor(durationMin / 60);
        const formattedDuration = durationHrs > 0 ? `${durationHrs}h ${durationMin % 60}m` : `${durationMin} minutos`;

        try {
            const owner = await guild.members.fetch(session.owner).catch(()=>null);
            if (owner) {
                const embed = new EmbedBuilder()
                    .setColor('#89b4fa')
                    .setTitle('📋 Relatório Pós-Operação')
                    .setDescription(`Seu squad **${channelName}** foi encerrado. Confira os dados da sessão:`)
                    .addFields(
                        { name: '⏱️ Duração', value: formattedDuration, inline: true },
                        { name: '👥 Participantes Únicos', value: `${session.participants.size} operadores`, inline: true },
                        { name: '📈 Reputação Ganha', value: '+15 Influência', inline: true }
                    )
                    .setFooter({ text: 'Sistema de Inteligência Operacional Polaris' });

                await owner.send({ embeds: [embed] }).catch(()=>{});
            }
        } catch (e) {
            logger.warn(`Não foi possível enviar relatório pós-ação: ${e.message}`);
        }
        
        this.callSessions.delete(channelId);
    }

    static async closeSquad(channel, guild, reason = 'Squad encerrado.') {
        const channelId = channel.id;
        try {
            // Gera o resumo automático antes de deletar
            await this.generatePostActionReport(channelId, channel.name, guild);

            this.activeChannels.delete(channelId);
            
            const textChannel = guild.channels.cache.find(c => c.topic === `LinkedVoice:${channelId}`);
            if (textChannel) await textChannel.delete(reason).catch(()=>{});
            
            await supabase.from('temp_channels').delete().eq('channel_id', channelId);
            await channel.delete(reason);
            logger.info(`Sala temporária ${channel.name} deletada: ${reason}`);
            return true;
        } catch (error) {
            logger.error(`Erro ao deletar sala temporária ${channelId}: ${error.message}`);
            throw error;
        }
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
