import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import os from 'os';
import { BackupService } from '../../services/BackupService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Comandos restritos ao Owner do Bot.')
        .addSubcommand(subcmd => 
            subcmd.setName('status').setDescription('Mostra o status interno do sistema do bot.')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('backup-criar').setDescription('Gera um backup completo do servidor atual.')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('backup-listar').setDescription('Lista os backups disponíveis para o servidor atual.')
        ),
    accessLevel: 5, // Owner do Bot
    cooldown: 0, // Sem cooldown para owner
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            const memoryUsage = process.memoryUsage();
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000') // Vermelho para status de sistema crítico
                .setTitle('Status Interno do Sistema')
                .addFields(
                    { name: 'Uso de RAM', value: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
                    { name: 'RAM Total OS', value: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`, inline: true },
                    { name: 'RAM Livre OS', value: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`, inline: true },
                    { name: 'Uptime', value: `${(process.uptime() / 60).toFixed(2)} minutos`, inline: true },
                    { name: 'Plataforma', value: `${os.platform()} ${os.arch()}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } 
        else if (subcommand === 'backup-criar') {
            await interaction.deferReply({ ephemeral: true });
            try {
                const filename = await BackupService.createBackup(interaction.guild, false);
                await interaction.editReply(`✅ Backup manual do servidor gerado com sucesso!\nArquivo: \`${filename}\``);
            } catch (error) {
                await interaction.editReply(`❌ Erro ao criar backup: ${error.message}`);
            }
        }
        else if (subcommand === 'backup-listar') {
            await interaction.deferReply({ ephemeral: true });
            try {
                const list = await BackupService.listBackups(interaction.guild.id);
                if (list.length === 0) {
                    return interaction.editReply('📭 Nenhum backup encontrado para este servidor.');
                }
                
                const text = list.map((b, idx) => {
                    const time = b.createdAt.toLocaleString('pt-BR');
                    const sizeKB = (b.sizeBytes / 1024).toFixed(2);
                    return `**#${idx + 1}** - \`${b.filename}\`\n└ Criado em: *${time}* | Tamanho: *${sizeKB} KB*`;
                }).join('\n\n');

                const embed = new EmbedBuilder()
                    .setColor('#89b4fa')
                    .setTitle('🗄️ Backups do Servidor')
                    .setDescription(text.substring(0, 4096))
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                await interaction.editReply(`❌ Erro ao listar backups: ${error.message}`);
            }
        }
    },
};
