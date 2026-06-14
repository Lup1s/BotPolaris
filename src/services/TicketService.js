import { ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

export class TicketService {
    static async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'open_ticket') {
            await interaction.deferReply({ flags: 64 });
            
            const guild = interaction.guild;
            const category = guild.channels.cache.find(c => c.name === '🛡️ SUPORTE' && c.type === ChannelType.GuildCategory);
            
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
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Fechar Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ content: `${interaction.user.toString()}`, embeds: [embed], components: [row] });
                await interaction.editReply(`✅ Ticket criado com sucesso em ${ticketChannel.toString()}.`);
                
                logger.info(`Ticket ${ticketChannel.name} criado para ${interaction.user.tag}.`);
            } catch (error) {
                logger.error(`Erro ao criar ticket: ${error.message}`);
                await interaction.editReply(`❌ Erro ao criar o ticket: ${error.message}`);
            }
        }

        if (interaction.customId === 'close_ticket') {
            const channel = interaction.channel;
            await interaction.reply({ content: '🔒 O ticket será fechado e apagado em 5 segundos...' });
            setTimeout(() => {
                channel.delete('Ticket fechado pelo usuário.').catch(()=>{});
                logger.info(`Ticket ${channel.name} fechado.`);
            }, 5000);
        }
    }
}