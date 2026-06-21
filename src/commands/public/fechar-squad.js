import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { TempVoiceService } from '../../services/TempVoiceService.js';

const data = new SlashCommandBuilder()
    .setName('fechar-squad')
    .setDescription('Fecha o seu squad ativo (canal temporário).');

async function execute(interaction) {
    const { member, guild } = interaction;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para usar este comando.', flags: 64 });
    }

    if (!TempVoiceService.isTempChannel(voiceChannel.id)) {
        return interaction.reply({ content: '❌ Este não é um canal temporário gerenciável.', flags: 64 });
    }

    const isOwner = TempVoiceService.isOwner(voiceChannel.id, member.id);
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

    if (!isOwner && !isAdmin) {
        return interaction.reply({ content: '❌ Apenas o dono do squad (ou um Administrador) pode encerrá-lo.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    try {
        await TempVoiceService.closeSquad(voiceChannel, guild, `Squad encerrado por ${interaction.user.tag}`);
        await interaction.editReply({ content: '✅ Squad encerrado com sucesso! A sala e o chat temporários foram removidos.' });
    } catch (error) {
        await interaction.editReply({ content: `❌ Erro ao fechar o squad: ${error.message}` });
    }
}

export default { data, execute, accessLevel: 1, cooldown: 10 };