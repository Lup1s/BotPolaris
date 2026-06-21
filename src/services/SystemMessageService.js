import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
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
                    hoist: true,
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
            COMPETITIVO: await this.getOrCreateCategory(guild, '⚔️ COMPETITIVO'),
            SUPORTE: await this.getOrCreateCategory(guild, '🎫 SUPORTE'),
            VOZ: await this.getOrCreateCategory(guild, '🔊 VOZ'),
            AMBIENTES: await this.getOrCreateCategory(guild, '📱 AMBIENTES PRIVADOS')
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
            { id: 'anuncios', name: '📢・anuncios', parent: categories.INFO.id, type: ChannelType.GuildText },
            { id: 'noticias', name: '📰・noticias', parent: categories.INFO.id, type: ChannelType.GuildText },
            
            { id: 'central', name: '🎮・central-do-jogador', parent: categories.COMUNIDADE.id, type: ChannelType.GuildText },
            { id: 'geral', name: '💬・geral', parent: categories.COMUNIDADE.id, type: ChannelType.GuildText },
            { id: 'midia', name: '📸・midia-e-clipes', parent: categories.COMUNIDADE.id, type: ChannelType.GuildText },
            { id: 'squad', name: '🎯・procurar-squad', parent: categories.COMUNIDADE.id, type: ChannelType.GuildText },
            
            { id: 'mix_hub', name: '⚔️・mix-e-campeonatos', parent: categories.COMPETITIVO.id, type: ChannelType.GuildText },
            { id: 'resultados', name: '🏅・resultados', parent: categories.COMPETITIVO.id, type: ChannelType.GuildText },
            
            { id: 'tickets', name: '🎫・suporte', parent: categories.SUPORTE.id, type: ChannelType.GuildText },

            { id: 'voz_geral', name: '💬 Geral', parent: categories.VOZ.id, type: ChannelType.GuildVoice },
            { id: 'voz_lounge', name: '🎧 Lounge', parent: categories.VOZ.id, type: ChannelType.GuildVoice },
            { id: 'criar_squad', name: '➕ Criar Squad', parent: categories.VOZ.id, type: ChannelType.GuildVoice }
        ];

        for (const def of channelsDef) {
            const channel = await this.getOrCreateChannel(guild, def);
            this.config.channels[def.id] = channel.id;

            // Enviar/Recriar mensagens estáticas
            if (def.id === 'regras') await this.ensureRulesMessage(channel);
            if (def.id === 'tickets') await this.ensureTicketMessage(channel);
            if (def.id === 'squad') await this.ensureLfgMessage(channel);
            if (def.id === 'central') await this.ensureCentralMessage(channel);
            if (def.id === 'mix_hub') await this.ensureMixHubMessage(channel);
        }

        await this.saveDb();
        logger.info(`Setup de Comunidade concluído.`);
    }

    static async configureExistingChannels(guild) {
        logger.info(`Reconfigurando canais existentes no servidor ${guild.name}...`);

        const everyoneRole = guild.roles.everyone;

        // Obter os cargos de Staff/Administradores para conceder permissão de escrita
        const staffRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('staff') || r.name.toLowerCase().includes('moderador') || r.name.toLowerCase().includes('mod'));
        const adminRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('administrador'));

        const keys = ['boas_vindas', 'regras', 'avisos', 'anuncios', 'noticias', 'comandos'];

        for (const key of keys) {
            const channelId = this.config.channels[key];
            if (!channelId) continue;

            const channel = guild.channels.cache.get(channelId);
            if (!channel) {
                logger.warn(`Canal para chave "${key}" com ID ${channelId} não encontrado no servidor.`);
                continue;
            }

            try {
                // Definir as permissões base para @everyone
                const allowPerms = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory];
                const denyPerms = [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions];

                if (key === 'comandos') {
                    allowPerms.push(PermissionsBitField.Flags.UseApplicationCommands);
                }

                const overwrites = [
                    {
                        id: everyoneRole.id,
                        allow: allowPerms,
                        deny: denyPerms
                    }
                ];

                // Para canais onde a Staff/Admin pode escrever (avisos, anuncios, noticias)
                if (['avisos', 'anuncios', 'noticias'].includes(key)) {
                    if (adminRole) {
                        overwrites.push({
                            id: adminRole.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.EmbedLinks,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.MentionEveryone
                            ]
                        });
                    }
                    if (staffRole) {
                        overwrites.push({
                            id: staffRole.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.EmbedLinks,
                                PermissionsBitField.Flags.AttachFiles
                            ]
                        });
                    }
                }

                await channel.permissionOverwrites.set(overwrites, 'Reconfiguração automática de segurança do canal.');
                logger.info(`Permissões do canal #${channel.name} (${key}) reconfiguradas.`);

                // Garante que o painel de regras ou lista de comandos existam
                if (key === 'regras') {
                    await this.ensureRulesMessage(channel);
                } else if (key === 'comandos') {
                    await this.ensureCommandsListMessage(channel);
                }
            } catch (err) {
                logger.error(`Erro ao reconfigurar permissões do canal ${channelId} (${key}): ${err.message}`);
            }
        }
        
        await this.saveDb();
    }

    static async ensureCommandsListMessage(channel) {
        const msgId = this.config.messages.comandos_lista;
        if (msgId) {
            try {
                await channel.messages.fetch(msgId);
                return; // Já existe
            } catch (e) { /* Apagada */ }
        }

        const embed = new EmbedBuilder()
            .setColor('#89b4fa') // Cor temática
            .setTitle('🌌 Central de Operações: Comandos do Bot')
            .setDescription('Aqui está a lista de comandos de barra (/) disponíveis para todos os membros no servidor. Use os comandos diretamente no chat deste canal!')
            .addFields(
                { 
                    name: '👤 Utilidades e Social', 
                    value: '• `/perfil` - Mostra seu perfil social, patente militar, prestígio e estatísticas.\n' +
                           '• `/ranking` - Exibe o Quadro de Honra com o Top 10 de membros em XP.\n' +
                           '• `/ping` - Verifica a latência atual do bot e da API do Discord.\n' +
                           '• `/info` - Informações técnicas sobre a arquitetura do BotPolaris.',
                    inline: false 
                },
                { 
                    name: '🎯 Gerenciamento de Squad (Canais Temporários)', 
                    value: '• `/sala info` - Mostra as informações da sua sala de voz atual.\n' +
                           '• `/sala renomear [nome]` - Altera o nome do seu canal temporário.\n' +
                           '• `/sala limite [número]` - Define um limite de usuários na call (0 para ilimitado).\n' +
                           '• `/sala bloquear` / `/sala liberar` - Controla se novos membros podem conectar na call.\n' +
                           '• `/sala privado` / `/sala publico` - Controla a visibilidade da sala na lista de canais.\n' +
                           '• `/sala convidar [usuário]` - Permite que alguém específico entre na sua sala trancada.\n' +
                           '• `/sala expulsar [usuário]` - Remove e bloqueia um usuário da sua call.\n' +
                           '• `/sala transferir [usuário]` - Passa a liderança da sala para outro membro.\n' +
                           '• `/fechar-squad` - Encerra imediatamente o seu canal de voz e chat temporários.',
                    inline: false 
                },
                { 
                    name: '🎮 Jogos e Competitivo', 
                    value: '• `/vincular valorant [Riot_ID#Tag]` - Associa sua conta do Valorant e recebe o cargo correspondente ao seu Elo automaticamente.\n' +
                           '• `/mix [jogo] [tamanho_lobby]` - Cria um lobby para partida customizada, realiza o sorteio equilibrado de times e move todos automaticamente para as calls.',
                    inline: false 
                }
            )
            .setThumbnail('https://i.imgur.com/8QG3mQ9.png')
            .setFooter({ text: 'Dica: Digite / para abrir a lista interativa de comandos do Discord.' })
            .setTimestamp();

        const msg = await channel.send({ embeds: [embed] });
        if (msg.pinnable) await msg.pin().catch(()=>{});
        
        this.config.messages.comandos_lista = msg.id;
        await this.saveDb();
    }

    // Engine de Ambientes Dinâmicos (Workspaces)
    static async createPrivateEnvironment(guild, member, envType, icon, setupCallback) {
        const category = await this.getOrCreateCategory(guild, '📱 AMBIENTES PRIVADOS');
        const channelName = `${icon}・${envType}-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

        let channel = guild.channels.cache.find(c => c.name === channelName && c.parentId === category.id);
        if (!channel) {
            channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });
            await setupCallback(channel);
        }
        return channel;
    }

    // Função inteligente para ignorar emojis, espaços, traços e acentos
    static cleanName(name) {
        if (!name) return '';
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    static async getOrCreateCategory(guild, name) {
        const targetClean = this.cleanName(name);
        let category = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildCategory && 
            this.cleanName(c.name) === targetClean
        );
        
        if (!category) {
            category = await guild.channels.create({ name: name, type: ChannelType.GuildCategory });
        } else if (category.name !== name) {
            // Se encontrou a categoria mas o nome está diferente, atualiza
            await category.setName(name).catch(()=>{});
        }
        return category;
    }

    static async getOrCreateChannel(guild, def) {
        const targetClean = this.cleanName(def.name);
        let channel = guild.channels.cache.find(c => 
            c.type === def.type && 
            this.cleanName(c.name) === targetClean
        );
        
        if (!channel) {
            const options = { 
                name: def.name, 
                type: def.type, 
                parent: def.parent 
            };
            if (def.type === ChannelType.GuildForum && def.availableTags) options.availableTags = def.availableTags;
            if (def.permissionOverwrites) options.permissionOverwrites = def.permissionOverwrites;
            
            channel = await guild.channels.create(options);
        } else {
            // Canal encontrado! Verifica se precisa corrigir nome, categoria ou permissões
            const updates = {};
            if (channel.name !== def.name) updates.name = def.name;
            if (channel.parentId !== def.parent) updates.parent = def.parent;
            
            if (Object.keys(updates).length > 0) await channel.edit(updates).catch(()=>{});
            if (def.permissionOverwrites) await channel.permissionOverwrites.set(def.permissionOverwrites).catch(()=>{});
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

    static async ensureCentralMessage(channel) {
        const msgId = this.config.messages.central;
        if (msgId) {
            try {
                await channel.messages.fetch(msgId);
                return;
            } catch (e) { /* Apagada */ }
        }

        const embed = new EmbedBuilder()
            .setColor('#89b4fa')
            .setTitle('🎮 Painel do Jogador Polaris')
            .setDescription('Bem-vindo à Central! Acesse todas as funcionalidades da sua conta utilizando os botões abaixo.')
            .setImage('https://i.imgur.com/8QG3mQ9.png'); // Substituir por um banner da sua comunidade

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('central_perfil').setLabel('Meu Perfil').setStyle(ButtonStyle.Primary).setEmoji('👤'),
            new ButtonBuilder().setCustomId('central_ranking').setLabel('Ranking Geral').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('central_patentes').setLabel('Patentes').setStyle(ButtonStyle.Secondary).setEmoji('🎖️')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_lfg_modal').setLabel('Procurar Squad').setStyle(ButtonStyle.Success).setEmoji('🎯')
        );

        const msg = await channel.send({ embeds: [embed], components: [row1, row2] });
        this.config.messages.central = msg.id;
        await this.saveDb();
    }

    static async ensureMixHubMessage(channel) {
        const msgId = this.config.messages.mix_hub;
        if (msgId) {
            try {
                await channel.messages.fetch(msgId);
                return;
            } catch (e) { /* Apagada */ }
        }

        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⚔️ Central de Mix e Campeonatos')
            .setDescription('Participe de partidas ranqueadas internas! Crie um Mix, aguarde os jogadores e o sistema montará as equipes equilibradas automaticamente.');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_mix_modal').setLabel('Iniciar Mix').setStyle(ButtonStyle.Danger).setEmoji('⚔️')
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        if (msg.pinnable) await msg.pin().catch(()=>{});
        this.config.messages.mix_hub = msg.id;
        await this.saveDb();
    }

    static async ensureLfgMessage(channel) {
        const msgId = this.config.messages.lfg;
        if (msgId) {
            try {
                await channel.messages.fetch(msgId);
                return;
            } catch (e) { /* Apagada */ }
        }

        const embed = new EmbedBuilder()
            .setColor('#f9e2af')
            .setTitle('🎯 Central de Esquadrões (LFG)')
            .setDescription('Quer jogar mas está sem time?\n\nClique no botão abaixo para abrir um formulário de recrutamento. Sua chamada será publicada aqui para outros membros entrarem.');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_lfg_modal')
                .setLabel('➕ Montar Esquadrão')
                .setStyle(ButtonStyle.Success)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        if (msg.pinnable) await msg.pin().catch(()=>{});
        this.config.messages.lfg = msg.id;
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
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`welcome_greet_${member.id}`)
                    .setLabel('Dar as Boas-Vindas!')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👋')
            );

            await channel.send({ embeds: [embed], components: [row] }).catch(()=>{});
        }

        // 3. DM
        member.send(`Bem-vindo(a) ao servidor **${guild.name}**! 🚀\nNão se esqueça de ir no canal de Regras e clicar no botão "Concordo" para liberar seu acesso a todos os chats!`).catch(()=>{});
        logger.info(`Novo membro alistado: ${member.user.tag}. Auto-role [Recruta] aplicado.`);
    }

    static async handleInteraction(interaction) {
        logger.debug(`[Interaction] Tipo: ${interaction.type} | ID/Comando: ${interaction.customId || interaction.commandName || 'N/A'} | Usuário: ${interaction.user.tag}`);
        try {
            if (interaction.isButton() && interaction.customId.startsWith('welcome_greet_')) {
                await interaction.deferReply({ flags: 64 });
                const targetMemberId = interaction.customId.replace('welcome_greet_', '');
                await interaction.editReply({ content: '✅ Você deu boas-vindas para o novo recruta!' });

                const greetMsg = await interaction.channel.send(`👋 ${interaction.user.toString()} deu as boas-vindas a <@${targetMemberId}>!`);
                setTimeout(() => {
                    greetMsg.delete().catch(() => {});
                }, 5000);
                return;
            }

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
                        hoist: true,
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
                        role = await guild.roles.create({ name: roleName, color: 'Random', reason: 'Sistema de Auto-Registro', hoist: true });
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

        // Integrações Visuais da Central do Jogador
        if (interaction.isButton()) {
            if (interaction.customId === 'central_perfil') {
                await interaction.deferReply({ flags: 64 });
                const channel = await this.createPrivateEnvironment(interaction.guild, interaction.member, 'painel', '👤', async (ch) => {
                    const embed = await LevelingService.generateProfileEmbed(interaction.member);
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('env_close').setLabel('Encerrar Sessão').setStyle(ButtonStyle.Danger).setEmoji('✖️')
                    );
                    await ch.send({ content: `Bem-vindo ao seu painel privado, ${interaction.user.toString()}.`, embeds: [embed], components: [row] });
                });
                await interaction.editReply(`✅ Ambiente carregado com sucesso. Acesse: ${channel.toString()}`);
            } 
            else if (interaction.customId === 'central_ranking') {
                await interaction.deferReply({ flags: 64 });
                const channel = await this.createPrivateEnvironment(interaction.guild, interaction.member, 'ranking', '🏆', async (ch) => {
                    const embed = await LevelingService.generateRankingEmbed(interaction.guild);
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('env_close').setLabel('Encerrar Sessão').setStyle(ButtonStyle.Danger).setEmoji('✖️')
                    );
                    await ch.send({ content: interaction.user.toString(), embeds: [embed], components: [row] });
                });
                await interaction.editReply(`✅ Ambiente carregado. Acesse: ${channel.toString()}`);
            }
            else if (interaction.customId === 'central_patentes') {
                await interaction.deferReply({ flags: 64 });
                const channel = await this.createPrivateEnvironment(interaction.guild, interaction.member, 'patentes', '🎖️', async (ch) => {
                    const embed = LevelingService.generateRanksEmbed();
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('env_close').setLabel('Encerrar Sessão').setStyle(ButtonStyle.Danger).setEmoji('✖️')
                    );
                    await ch.send({ content: interaction.user.toString(), embeds: [embed], components: [row] });
                });
                await interaction.editReply(`✅ Ambiente carregado. Acesse: ${channel.toString()}`);
            }
            else if (interaction.customId === 'env_close') {
                await interaction.reply({ content: 'Limpando dados e excluindo ambiente...', flags: 64 });
                setTimeout(() => interaction.channel.delete().catch(()=>{}), 2000);
            }
        }

        // Lógica para abrir o Formulário Pop-up (Modal) de Esquadrão
        if (interaction.isButton() && interaction.customId === 'open_lfg_modal') {
            const modal = new ModalBuilder()
                .setCustomId('lfg_modal_submit')
                .setTitle('Montar Esquadrão');

            const jogoInput = new TextInputBuilder()
                .setCustomId('lfg_jogo')
                .setLabel('Qual jogo? (Ex: CS2, Valorant, LoL)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(30);

            const vagasInput = new TextInputBuilder()
                .setCustomId('lfg_vagas')
                .setLabel('Quantas vagas abertas? (Ex: 2)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2);

            const detalhesInput = new TextInputBuilder()
                .setCustomId('lfg_detalhes')
                .setLabel('Detalhes (Patente, modo, etc)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(200);

            modal.addComponents(
                new ActionRowBuilder().addComponents(jogoInput),
                new ActionRowBuilder().addComponents(vagasInput),
                new ActionRowBuilder().addComponents(detalhesInput)
            );

            await interaction.showModal(modal);
        }

        // Lógica de quando o membro preenche e envia o Formulário
        if (interaction.isModalSubmit() && interaction.customId === 'lfg_modal_submit') {
            const jogo = interaction.fields.getTextInputValue('lfg_jogo');
            const vagasStr = interaction.fields.getTextInputValue('lfg_vagas');
            const detalhes = interaction.fields.getTextInputValue('lfg_detalhes');
            
            const vagas = parseInt(vagasStr);
            if (isNaN(vagas) || vagas < 1 || vagas > 20) {
                return interaction.reply({ content: '❌ O número de vagas deve ser um número válido entre 1 e 20.', flags: 64 });
            }

            const member = interaction.member;

            // Tenta encontrar o cargo no servidor para marcar (pingar) a galera daquele jogo inteligentemente
            let rolePing = '';
            const jogoLower = jogo.toLowerCase();
            const role = interaction.guild.roles.cache.find(r => 
                r.name.toLowerCase() === `jogador de ${jogoLower}` || 
                (r.name.toLowerCase().includes(jogoLower) && r.name.toLowerCase().includes('jogador'))
            );
            if (role) rolePing = role.toString();

            const totalVagas = vagas + 1; // Vagas abertas + o Líder

            const embed = new EmbedBuilder()
                .setColor('#f9e2af') // Cor amarela pastel
                .setTitle(`🎮 Procurando Esquadrão: ${jogo}`)
                .setDescription(`O jogador ${member.toString()} está recrutando!`)
                .addFields(
                    { name: '👑 Líder', value: member.toString(), inline: true },
                    { name: '👥 Vagas', value: `1/${totalVagas}`, inline: true },
                    { name: '📝 Detalhes', value: detalhes || 'Nenhum detalhe adicional informado.', inline: false },
                    { name: '✅ Confirmados (1)', value: member.toString(), inline: false },
                    { name: '❓ Talvez (0)', value: 'Ninguém ainda', inline: false }
                )
                .setFooter({ text: `Vagas Totais: ${totalVagas} | Líder ID: ${member.id}` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('lfg_join').setLabel('Eu vou!').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('lfg_maybe').setLabel('Talvez').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
                new ButtonBuilder().setCustomId('lfg_leave').setLabel('Sair').setStyle(ButtonStyle.Danger).setEmoji('🚪')
            );

            await interaction.reply({ content: rolePing || null, embeds: [embed], components: [row] });
        }

        // Lógica do LFG (Procurando Esquadrão)
        if (interaction.isButton() && interaction.customId.startsWith('lfg_')) {
            const embed = interaction.message.embeds[0];
            if (!embed) return;

            const memberMention = interaction.user.toString();
            const fields = embed.fields;
            
            const confirmField = fields.find(f => f.name.startsWith('✅ Confirmados'));
            const maybeField = fields.find(f => f.name.startsWith('❓ Talvez'));
            
            // Busca a configuração escondida no rodapé da mensagem
            const totalSlotsMatch = embed.footer.text.match(/Vagas Totais: (\d+)/);
            const totalSlots = totalSlotsMatch ? parseInt(totalSlotsMatch[1]) : 5;
            const leaderIdMatch = embed.footer.text.match(/Líder ID: (\d+)/);
            const leaderId = leaderIdMatch ? leaderIdMatch[1] : '';

            if (interaction.customId === 'lfg_leave' && interaction.user.id === leaderId) {
                return interaction.reply({ content: '❌ Você é o líder do esquadrão! Se quiser cancelar o chamado, apague a mensagem.', flags: 64 });
            }

            let confirmList = confirmField.value === 'Ninguém ainda' ? [] : confirmField.value.split('\n');
            let maybeList = maybeField.value === 'Ninguém ainda' ? [] : maybeField.value.split('\n');

            // Remove o usuário das listas atuais (para evitar duplicações se ele trocar de opção)
            confirmList = confirmList.filter(u => u !== memberMention);
            maybeList = maybeList.filter(u => u !== memberMention);

            if (interaction.customId === 'lfg_join') {
                if (confirmList.length >= totalSlots) return interaction.reply({ content: '❌ As vagas para este esquadrão já estão preenchidas!', flags: 64 });
                confirmList.push(memberMention);
            } else if (interaction.customId === 'lfg_maybe') {
                maybeList.push(memberMention);
            }

            const confirmStr = confirmList.length > 0 ? confirmList.join('\n') : 'Ninguém ainda';
            const maybeStr = maybeList.length > 0 ? maybeList.join('\n') : 'Ninguém ainda';

            const newEmbed = EmbedBuilder.from(embed).setFields(
                embed.fields.map(f => {
                    if (f.name.startsWith('✅ Confirmados')) return { name: `✅ Confirmados (${confirmList.length})`, value: confirmStr, inline: false };
                    if (f.name.startsWith('❓ Talvez')) return { name: `❓ Talvez (${maybeList.length})`, value: maybeStr, inline: false };
                    if (f.name === '👥 Vagas') return { name: '👥 Vagas', value: `${confirmList.length}/${totalSlots}`, inline: true };
                    return f;
                })
            );

            await interaction.update({ embeds: [newEmbed] });
        }

        // Formulário do Mix Competitivo
        if (interaction.isButton() && interaction.customId === 'open_mix_modal') {
            const modal = new ModalBuilder()
                .setCustomId('mix_modal_submit')
                .setTitle('Iniciar Mix Competitivo');

            const jogoInput = new TextInputBuilder().setCustomId('mix_jogo').setLabel('Qual Jogo? (Ex: CS2, Valorant)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
            const vagasInput = new TextInputBuilder().setCustomId('mix_vagas').setLabel('Vagas Totais (Ex: 10)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3);
            
            modal.addComponents(new ActionRowBuilder().addComponents(jogoInput), new ActionRowBuilder().addComponents(vagasInput));
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'mix_modal_submit') {
            const jogo = interaction.fields.getTextInputValue('mix_jogo');
            const tamanho = parseInt(interaction.fields.getTextInputValue('mix_vagas'));
            const member = interaction.member;

            if (isNaN(tamanho) || tamanho < 2) return interaction.reply({ content: '❌ Número de vagas inválido.', flags: 64 });

            const embed = new EmbedBuilder()
                .setColor('#a6e3a1')
                .setTitle(`🏆 Mix de ${jogo}`)
                .setDescription(`Clique no botão abaixo para entrar na fila do Mix!\n\nQuando a fila atingir **${tamanho} jogadores**, os times serão sorteados inteligentemente baseados no MMR e as calls serão geradas.`)
                .addFields({ name: `👥 Jogadores (1/${tamanho})`, value: member.toString(), inline: false })
                .setFooter({ text: `Status: Aguardando jogadores... | Vagas: ${tamanho}` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('mix_join').setLabel('Entrar no Mix').setStyle(ButtonStyle.Success).setEmoji('🎮'),
                new ButtonBuilder().setCustomId('mix_leave').setLabel('Sair').setStyle(ButtonStyle.Danger).setEmoji('🚪')
            );

            await interaction.reply({ embeds: [embed], components: [row] });
        }

        // Lógica do Sistema de MIX (Partidas Customizadas e Sorteio)
        if (interaction.isButton() && ['mix_join', 'mix_leave'].includes(interaction.customId)) {
            const embed = interaction.message.embeds[0];
            if (!embed || !embed.footer?.text || !embed.footer.text.includes('Status: Aguardando jogadores...')) return;

            // Lê o tamanho exigido do rodapé
            const vagasMatch = embed.footer.text.match(/Vagas: (\d+)/);
            const maxPlayers = vagasMatch ? parseInt(vagasMatch[1]) : 10;
            
            const field = embed.fields[0];
            let players = field.value === 'Ninguém ainda' ? [] : field.value.split('\n');
            const memberMention = interaction.user.toString();

            if (interaction.customId === 'mix_leave') {
                players = players.filter(p => p !== memberMention);
            } else if (interaction.customId === 'mix_join') {
                if (!players.includes(memberMention)) players.push(memberMention);
            }

            // Verifica se a fila encheu
            if (players.length >= maxPlayers) {
                await interaction.update({ components: [] }); // Desativa os botões
                
                // Mágica: Sorteia os times de forma aleatória justa
                const shuffled = players.sort(() => 0.5 - Math.random());
                const mid = Math.ceil(maxPlayers / 2);
                const timeA = shuffled.slice(0, mid);
                const timeB = shuffled.slice(mid, maxPlayers);

                const newEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle(embed.title)
                    .setDescription('✅ **A fila encheu e os times foram sorteados!**\nAs calls de voz foram geradas e quem estiver conectado será movido automaticamente.')
                    .addFields(
                        { name: `🔵 Time A (${timeA.length})`, value: timeA.join('\n'), inline: true },
                        { name: `🔴 Time B (${timeB.length})`, value: timeB.join('\n'), inline: true }
                    )
                    .setFooter({ text: 'Status: Mix Iniciado!' });

                const rowWin = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('mix_win_a').setLabel('Vitória Time A').setStyle(ButtonStyle.Primary).setEmoji('🔵'),
                    new ButtonBuilder().setCustomId('mix_win_b').setLabel('Vitória Time B').setStyle(ButtonStyle.Danger).setEmoji('🔴')
                );

                await interaction.message.edit({ embeds: [newEmbed], components: [rowWin] });

                // Auto-Move: Puxa os jogadores pras calls!
                try {
                    const guild = interaction.guild;
                    const category = guild.channels.cache.find(c => c.name.includes('VOZ') || c.type === ChannelType.GuildCategory);
                    
                    let canalA = guild.channels.cache.find(c => c.name === '🔵 Time A (Mix)' && c.type === ChannelType.GuildVoice);
                    if (!canalA) canalA = await guild.channels.create({ name: '🔵 Time A (Mix)', type: ChannelType.GuildVoice, parent: category?.id });
                    
                    let canalB = guild.channels.cache.find(c => c.name === '🔴 Time B (Mix)' && c.type === ChannelType.GuildVoice);
                    if (!canalB) canalB = await guild.channels.create({ name: '🔴 Time B (Mix)', type: ChannelType.GuildVoice, parent: category?.id });

                    const movePlayers = async (team, channel) => {
                        for (const mention of team) {
                            const id = mention.replace(/\D/g, '');
                            const m = await guild.members.fetch(id).catch(()=>{});
                            // Só move quem já estiver em ALGUMA call de voz no servidor
                            if (m && m.voice.channel) await m.voice.setChannel(channel).catch(()=>{});
                        }
                    };

                    await movePlayers(timeA, canalA);
                    await movePlayers(timeB, canalB);

                } catch (err) {
                    logger.error(`Erro ao mover membros no Mix: ${err.message}`);
                }
            } else {
                // Fila não encheu ainda, apenas atualiza a contagem
                const newEmbed = EmbedBuilder.from(embed).setFields([
                    { name: `👥 Jogadores (${players.length}/${maxPlayers})`, value: players.length > 0 ? players.join('\n') : 'Ninguém ainda' }
                ]);
                await interaction.update({ embeds: [newEmbed] });
            }
        }
        
        // Pós-Partida (Resultados do Mix)
        if (interaction.isButton() && interaction.customId.startsWith('mix_win_')) {
            const embed = interaction.message.embeds[0];
            if (!embed) return;
            
            const isBlueWin = interaction.customId === 'mix_win_a';
            const fieldA = embed.fields.find(f => f.name.includes('Time A')).value.split('\n');
            const fieldB = embed.fields.find(f => f.name.includes('Time B')).value.split('\n');
            
            // Garante que só quem jogou pode votar o encerramento
            const allPlayers = [...fieldA, ...fieldB];
            if (!allPlayers.includes(interaction.user.toString()) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Apenas os jogadores do Mix ou Admins podem declarar o vencedor.', flags: 64 });
            }

            // Processa XP e Status
            const processTeam = async (teamMentions, isWinner) => {
                for (const mention of teamMentions) {
                    const id = mention.replace(/\D/g, '');
                    const data = LevelingService.getUserData(id);
                    if (isWinner) {
                        data.mixWins = (data.mixWins || 0) + 1;
                        data.xp += 150; // Bônus gigante de vitória
                    } else {
                        data.mixLosses = (data.mixLosses || 0) + 1;
                        data.xp += 20; // Bônus de consolação
                    }
                }
            };

            await processTeam(fieldA, isBlueWin);
            await processTeam(fieldB, !isBlueWin);
            await LevelingService.saveDb();

            const newEmbed = EmbedBuilder.from(embed)
                .setTitle('🏆 Mix Encerrado')
                .setDescription(`Partida finalizada! O **Time ${isBlueWin ? 'A' : 'B'}** venceu!\n\n*(Estatísticas, MMR e Experiência Militar foram creditados às contas dos jogadores)*.`)
                .setColor(isBlueWin ? '#00a8ff' : '#e74c3c');
                
            await interaction.update({ embeds: [newEmbed], components: [] });
            
            // Limpa as calls
            const guild = interaction.guild;
            guild.channels.cache.filter(c => ['🔵 Time A (Mix)', '🔴 Time B (Mix)'].includes(c.name)).forEach(c => c.delete().catch(()=>{}));
        }
        } catch (error) {
            logger.error(`[SystemMessageService] Falha crítica ao processar interação ${interaction.customId || 'N/A'}: ${error.message}`);
            logger.debug(`Stack Trace:\n${error.stack}`);
            
            try {
                const replyMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
                await interactionreplyMethod;
            } catch (e) {
                // Ignora se o Discord não deixar mais responder
            }
        }
    }
}