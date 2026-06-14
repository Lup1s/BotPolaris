import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { logger } from '../utils/logger.js';
import { BackupService } from '../services/BackupService.js';

export const requireConfirmation = async (interaction, summaryText, destructiveAction) => {
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Confirmar e Executar')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const response = await interaction.reply({
        content: `⚠️ **Atenção! Ação Crítica Requerida.**\n\n**Resumo da Ação:**\n${summaryText}\n\n*Um backup automático será gerado antes da execução.* Você tem 30 segundos para confirmar.`,
        components: [row],
        ephemeral: true
    });

    const collector = response.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 30000 
    });

    collector.on('collect', async i => {
        if (i.customId === 'confirm') {
            await i.update({ content: '⏳ Gerando backup de segurança e executando a ação...', components: [] });
            
            try {
                // 1. Criar backup automático
                await BackupService.createBackup(interaction.guild, true);

                // 2. Executar ação
                await destructiveAction();

                // 3. Registrar Log
                logger.security(`Ação destrutiva executada com sucesso por ${interaction.user.tag} após confirmação. Resumo: ${summaryText}`);
                
                await i.editReply({ content: '✅ Ação executada com sucesso. Backup de segurança criado.' });
            } catch (error) {
                logger.error(`Erro ao executar ação destrutiva: ${error.message}`);
                await i.editReply({ content: `❌ Erro ao executar a ação: ${error.message}` });
            }
        } else if (i.customId === 'cancel') {
            logger.info(`Ação cancelada pelo usuário ${interaction.user.tag}.`);
            await i.update({ content: '🛑 Ação cancelada com sucesso.', components: [] });
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            interaction.editReply({ content: '⏱️ Tempo esgotado. Ação cancelada automaticamente.', components: [] }).catch(() => {});
        }
    });
};
