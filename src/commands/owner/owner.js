import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import os from 'os';

export default {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Comandos restritos ao Owner do Bot.')
        .addSubcommand(subcmd => 
            subcmd.setName('status').setDescription('Mostra o status interno do sistema do bot.')
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
    },
};
