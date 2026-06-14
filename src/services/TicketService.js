import { ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

export class TicketService {
    static async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'open_ticket') {
            await interaction.deferReply({ flags: 64 });
            
            const guild = interaction.guild;
            const category = guild.channels.cache.find(c => c.name === '🎫 SUPORTE' && c.type === ChannelType.GuildCategory);
            
            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

            // Verificar se já tem ticket
            const existingChannel = guild.channels.cache.find(c => c.name === channelName && c.parentId === category?.id);
            if (existingChannel) {
                return interaction.editReply(`❌ Você já possui um ticket aberto em ${existingChannel.toString()}.`);
            }

            try {
                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: category ? category.id : null,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        }
                    ],
                    reason: `Ticket aberto por ${interaction.user.tag}`
                });

                const embed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle(`Ticket de ${interaction.user.username}`)
                    .setDescription('Descreva seu problema. A equipe de suporte irá te atender em breve.\n\nPara fechar o ticket, clique no botão abaixo.');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('🔒 Fechar')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('ticket_transcript')
                        .setLabel('Salvar Log')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📝')
                );

                await ticketChannel.send({ content: `${interaction.user.toString()}`, embeds: [embed], components: [row] });
                await interaction.editReply(`✅ Ticket criado com sucesso em ${ticketChannel.toString()}.`);
                
                logger.info(`Ticket ${ticketChannel.name} criado para ${interaction.user.tag}.`);
            } catch (error) {
                logger.error(`Erro ao criar ticket: ${error.message}`);
                await interaction.editReply(`❌ Erro ao criar o ticket: ${error.message}`);
            }
        }

        if (interaction.customId === 'ticket_close') {
            await interaction.reply({ 
                content: 'Tem certeza que deseja fechar e deletar este ticket?', 
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket_delete').setLabel('Confirmar Exclusão').setStyle(ButtonStyle.Danger)
                    )
                ]
            });
        }
        
        if (interaction.customId === 'ticket_delete') {
            const channel = interaction.channel;
            await interaction.reply({ content: '🔒 O ticket será fechado e apagado em 5 segundos...' });
            setTimeout(() => {
                channel.delete('Ticket fechado pelo usuário.').catch(()=>{});
                logger.info(`Ticket ${channel.name} fechado.`);
            }, 5000);
        }
        
        if (interaction.customId === 'ticket_transcript') {
            await interaction.deferReply({ flags: 64 });
            try {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const lines = messages.reverse().map(m => `[${m.createdAt.toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content || '[Anexo/Embed]'}`);
                const transcript = lines.join('\n');
                
                const buffer = Buffer.from(transcript, 'utf8');
                await interaction.editReply({ 
                    content: '✅ Transcrição gerada.',
                    files: [{ attachment: buffer, name: `transcript-${interaction.channel.name}.txt` }]
                });
            } catch (err) {
                await interaction.editReply('❌ Erro ao gerar a transcrição.');
            }
        }
    }
}