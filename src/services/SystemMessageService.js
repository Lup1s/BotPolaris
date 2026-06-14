import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import { LevelingService } from './LevelingService.js';

export class SystemMessageService {
    static dbPath = path.resolve('src', 'database', 'system_config.json');
    static config = {
        channels: {},
        messages: {}
    };

    static async init(client) {
        try {
            const dbDir = path.dirname(this.dbPath);
            if (!fsSync.existsSync(dbDir)) fsSync.mkdirSync(dbDir, { recursive: true });

            if (fsSync.existsSync(this.dbPath)) {
                const data = await fs.readFile(this.dbPath, 'utf8');
                this.config = JSON.parse(data);
            }

            logger.info('SystemMessageService iniciado.');
        } catch (error) {
            logger.error(`Erro no SystemMessageService: ${error.message}`);
        }
    }

    static async saveDb() {
        try {
            await fs.writeFile(this.dbPath, JSON.stringify(this.config, null, 4), 'utf8');
        } catch (error) {
            logger.error(`Erro ao salvar config do sistema: ${error.message}`);
        }
    }

    static async setupCommunity(guild) {
        logger.info(`Iniciando Setup de Comunidade no servidor ${guild.name}...`);

        // Automação: Configurar Permissões de Cargos Iniciais
        try {
            // 1. Remover permissão de ver canais e falar do @everyone
            const everyoneRole = guild.roles.everyone;
            const newEveryonePerms = everyoneRole.permissions.remove([
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages
            ]);
            await everyoneRole.setPermissions(newEveryonePerms, 'Setup automático de Onboarding');

            // 2. Criar ou atualizar o cargo "Membro Verificado" com as permissões corretas
            let verifiedRole = guild.roles.cache.find(r => r.name === 'Membro Verificado');
            if (!verifiedRole) {
                await guild.roles.create({
                    name: 'Membro Verificado',
                    color: '#a6e3a1',
                    reason: 'Cargo para membros que aceitaram as regras',
                    permissions: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.Speak
                    ]
                });
            }
        } catch (error) {
            logger.warn(`Aviso ao configurar cargos: ${error.message} (Verifique se o cargo do bot é o mais alto do servidor)`);
        }

        const categories = {
            INFO: await this.getOrCreateCategory(guild, '📌 INFORMAÇÕES'),
            COMUNIDADE: await this.getOrCreateCategory(guild, '💬 COMUNIDADE'),
            SUPORTE: await this.getOrCreateCategory(guild, '🎫 SUPORTE'),
            VOZ: await this.getOrCreateCategory(guild, '🔊 VÍDEO & VOZ')
        };

        const channelsDef = [
            { id: 'boas_vindas', name: '👋・boas-vindas', parent: categories.INFO.id, type: ChannelType.GuildText },
            { 
                id: 'regras', 
                name: '📜・regras', 
                parent: categories.INFO.id, 
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] }
                ]
            },
            { id: 'avisos', name: '📢・avisos', parent: categories.INFO.id, type: ChannelType.GuildText },
            
            { id: 'geral', name: '💬・chat-geral', parent: categories.COMUNIDADE.id, type: ChannelType.GuildText },
            { id: 'comandos', name: '🤖・comandos', parent: categories.COMUNIDADE.id, type: ChannelType.GuildText },
            { id: 'squad', name: '🎮・encontre-seu-squad', parent: categories.COMUNIDADE.id, type: ChannelType.GuildForum,
                availableTags: [
                    { name: 'CS2', emoji: { name: '🔫' } },
                    { name: 'Valorant', emoji: { name: '🔴' } },
                    { name: 'LoL', emoji: { name: '⚔️' } }
                ] 
            },
            
            { id: 'tickets', name: '🎫・tickets', parent: categories.SUPORTE.id, type: ChannelType.GuildText },

            { id: 'criar_call', name: '➕ Criar Call', parent: categories.VOZ.id, type: ChannelType.GuildVoice }
        ];

        for (const def of channelsDef) {
            const channel = await this.getOrCreateChannel(guild, def);
            this.config.channels[def.id] = channel.id;

            // Enviar/Recriar mensagens estáticas
            if (def.id === 'regras') await this.ensureRulesMessage(channel);
            if (def.id === 'tickets') await this.ensureTicketMessage(channel);
        }

        await this.saveDb();
        logger.info(`Setup de Comunidade concluído.`);
    }

    static async getOrCreateCategory(guild, name) {
        let category = guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await guild.channels.create({ name: name, type: ChannelType.GuildCategory });
        }
        return category;
    }

    static async getOrCreateChannel(guild, def) {
        let channel = guild.channels.cache.find(c => c.name === def.name && c.type === def.type && c.parentId === def.parent);
        if (!channel) {
            const options = { 
                name: def.name, 
                type: def.type, 
                parent: def.parent 
            };
            if (def.type === ChannelType.GuildForum && def.availableTags) {
                options.availableTags = def.availableTags;
            }
            if (def.permissionOverwrites) {
                options.permissionOverwrites = def.permissionOverwrites;
            }
            channel = await guild.channels.create(options);
        }
        return channel;
    }

    static async ensureRulesMessage(channel) {
        const msgId = this.config.messages.regras;
        if (msgId) {
            try {
                await channel.messages.fetch(msgId);
                return; // Já existe
            } catch (e) { /* Apagada */ }
        }

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('📜 Diretrizes e Regras')
            .setDescription('Para garantir a ordem no servidor, siga as regras abaixo:\n\n' +
                '**1.** Respeite todos os membros.\n' +
                '**2.** Não utilize cheats ou hacks.\n' +
                '**3.** Não pratique spam ou flood.\n' +
                '**4.** Utilize os canais corretamente.\n' +
                '**5.** Não publique conteúdo ilegal ou NSFW.\n' +
                '**6.** Respeite a equipe de moderação.\n' +
                '**7.** Mantenha o bom senso.\n' +
                '**8.** Divirta-se!\n\n' +
                'Clique no botão abaixo para concordar com as regras e liberar acesso ao servidor.');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accept_rules')
                .setLabel('✅ Concordo com as Regras')
                .setStyle(ButtonStyle.Success)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        if (msg.pinnable) await msg.pin().catch(()=>{});
        this.config.messages.regras = msg.id;
        await this.saveDb();
    }

    static async ensureTicketMessage(channel) {
        const msgId = this.config.messages.tickets;
        if (msgId) {
            try {
                await channel.messages.fetch(msgId);
                return;
            } catch (e) { /* Apagada */ }
        }

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🎫 Suporte e Tickets')
            .setDescription('Precisa de ajuda da nossa equipe de Staff? Encontrou algum bug, problema com usuário ou tem alguma dúvida?\n\nClique no botão abaixo para abrir um ticket privado.');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('🎫 Abrir Ticket')
                .setStyle(ButtonStyle.Primary)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        if (msg.pinnable) await msg.pin().catch(()=>{});
        this.config.messages.tickets = msg.id;
        await this.saveDb();
    }

    static async handleMemberJoin(member) {
        const guild = member.guild;
        // 1. Auto cargo de Recruta
        await LevelingService.updateMilitaryRole(member, 1);

        // 2. Enviar mensagem de boas vindas
        let channel = this.config.channels.boas_vindas ? guild.channels.cache.get(this.config.channels.boas_vindas) : null;
        
        // Fallback: Se não achar pelo ID do config, procura pelo nome
        if (!channel) channel = guild.channels.cache.find(c => ['boas-vindas', 'geral', 'chat-geral'].includes(c.name));

        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#89b4fa') // Cor temática do bot
                .setTitle(`🎉 Bem-vindo(a) à Base, ${member.user.username}!`)
                .setDescription(`Olá, ${member.toString()}! Você acaba de se alistar como **🪖 Recruta** em nossa comunidade.\n\n💬 Lembre-se de ler as regras para liberar seu acesso e participe das calls de voz para ganhar XP!`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `Agora somos ${guild.memberCount} membros!` })
                .setTimestamp();
            
            await channel.send({ embeds: [embed] }).catch(()=>{});
        }

        // 3. DM
        member.send(`Bem-vindo(a) ao servidor **${guild.name}**! 🚀\nNão se esqueça de ir no canal de Regras e clicar no botão "Concordo" para liberar seu acesso a todos os chats!`).catch(()=>{});
        logger.info(`Novo membro alistado: ${member.user.tag}. Auto-role [Recruta] aplicado.`);
    }

    static async handleInteraction(interaction) {
        if (interaction.isButton() && interaction.customId === 'accept_rules') {
            await interaction.deferReply({ flags: 64 });
            const member = interaction.member;
            const guild = interaction.guild;

            try {
                let role = guild.roles.cache.find(r => r.name === 'Membro Verificado' || r.name === 'Membro');
                if (!role) {
                    role = await guild.roles.create({ 
                        name: 'Membro Verificado', 
                        color: '#a6e3a1', 
                        reason: 'Cargo de verificação automática',
                        permissions: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak
                        ]
                    });
                }
                
                if (!member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    await interaction.editReply({ content: '✅ Regras aceitas! O cargo **Membro Verificado** foi adicionado e seu acesso foi liberado.' });
                    logger.info(`Usuário ${member.user.tag} aceitou as regras e foi verificado.`);
                } else {
                    await interaction.editReply({ content: '✅ Você já aceitou as regras e possui o acesso liberado!' });
                }
            } catch (error) {
                logger.error(`Erro ao dar cargo de verificação: ${error.message}`);
                await interaction.editReply({ content: '❌ Ocorreu um erro ao tentar liberar seu acesso. Por favor, contate a Staff.' });
            }
        }

        // Lógica para o menu de registro de jogos
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_games') {
            await interaction.deferReply({ flags: 64 }); // flags: 64 = Resposta efêmera (só o usuário vê)
            const guild = interaction.guild;
            const member = interaction.member;
            
            // Mapeamento dos valores do menu para o nome dos cargos no Discord
            const rolesMap = {
                'role_cs2': 'Jogador de CS2',
                'role_valorant': 'Jogador de Valorant',
                'role_lol': 'Jogador de LoL',
                'role_minecraft': 'Jogador de Minecraft'
            };

            const selectedValues = interaction.values;
            const allPossibleValues = Object.keys(rolesMap);

            try {
                let added = [];
                let removed = [];

                for (const value of allPossibleValues) {
                    const roleName = rolesMap[value];
                    // Procura o cargo no servidor, se não achar, o bot cria automaticamente!
                    let role = guild.roles.cache.find(r => r.name === roleName);
                    if (!role) {
                        role = await guild.roles.create({ name: roleName, color: 'Random', reason: 'Sistema de Auto-Registro' });
                    }

                    // Se o usuário selecionou essa opção, adicionamos o cargo
                    if (selectedValues.includes(value)) {
                        if (!member.roles.cache.has(role.id)) {
                            await member.roles.add(role);
                            added.push(role.name);
                        }
                    // Se não selecionou (ou desmarcou), removemos o cargo
                    } else {
                        if (member.roles.cache.has(role.id)) {
                            await member.roles.remove(role);
                            removed.push(role.name);
                        }
                    }
                }

                let replyMsg = '✅ Seus cargos foram atualizados com sucesso!\n\n';
                if (added.length > 0) replyMsg += `**Adicionados:** ${added.join(', ')}\n`;
                if (removed.length > 0) replyMsg += `**Removidos:** ${removed.join(', ')}`;
                if (added.length === 0 && removed.length === 0) replyMsg = 'Nenhuma alteração foi feita nos seus cargos.';

                await interaction.editReply({ content: replyMsg });
            } catch (error) {
                logger.error(`Erro no auto-registro: ${error.message}`);
                await interaction.editReply({ content: '❌ Houve um erro ao atualizar seus cargos. Tente novamente mais tarde.' });
            }
        }
    }
}