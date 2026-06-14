import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { TempVoiceService } from '../../services/TempVoiceService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('sala')
        .setDescription('Gerencie sua sala de voz temporária.')
        .addSubcommand(subcmd => 
            subcmd.setName('renomear')
                .setDescription('Muda o nome da sua sala.')
                .addStringOption(opt => opt.setName('nome').setDescription('O novo nome da sala').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('limite')
                .setDescription('Define o limite de usuários na sala.')
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('Limite (0 para ilimitado)').setRequired(true).setMinValue(0).setMaxValue(99))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('bloquear')
                .setDescription('Bloqueia a sala para que ninguém mais possa entrar.')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('liberar')
                .setDescription('Libera a sala para qualquer pessoa entrar.')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('transferir')
                .setDescription('Transfere a posse da sala para outro usuário.')
                .addUserOption(opt => opt.setName('usuario').setDescription('Novo dono da sala').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('expulsar')
                .setDescription('Expulsa um usuário da sua sala.')
                .addUserOption(opt => opt.setName('usuario').setDescription('Usuário a ser expulso').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('info')
                .setDescription('Mostra informações sobre a sala atual.')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('convidar')
                .setDescription('Permite que um usuário específico entre na sua sala (útil se estiver privada).')
                .addUserOption(opt => opt.setName('usuario').setDescription('Usuário a convidar').setRequired(true))
        )
        .addSubcommand(subcmd => 
            subcmd.setName('privado')
                .setDescription('Deixa a sala invisível para quem não está nela.')
        )
        .addSubcommand(subcmd => 
            subcmd.setName('publico')
                .setDescription('Torna a sala visível e acessível a todos.')
        ),
    accessLevel: 1, // Qualquer usuário
    cooldown: 5,
    async execute(interaction) {
        const { member, guild } = interaction;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para usar este comando.', flags: 64 });
        }

        if (!TempVoiceService.isTempChannel(voiceChannel.id)) {
            return interaction.reply({ content: '❌ Este não é um canal temporário gerenciável.', flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();
        const isOwner = TempVoiceService.isOwner(voiceChannel.id, member.id);
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

        // Apenas 'info' não requer ser dono
        if (subcommand !== 'info' && !isOwner && !isAdmin) {
            return interaction.reply({ content: '❌ Apenas o dono da sala (ou um Administrador) pode usar este comando.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            if (subcommand === 'renomear') {
                const novoNome = interaction.options.getString('nome');
                await voiceChannel.setName(novoNome, `Dono da sala renomeou`);
                await interaction.editReply(`✅ O nome da sala foi alterado para **${novoNome}**.`);
            } 
            else if (subcommand === 'limite') {
                const limite = interaction.options.getInteger('quantidade');
                await voiceChannel.setUserLimit(limite, `Dono da sala alterou o limite`);
                await interaction.editReply(`✅ O limite da sala foi alterado para ${limite === 0 ? '**Ilimitado**' : `**${limite}** usuários`}.`);
            }
            else if (subcommand === 'bloquear') {
                await voiceChannel.permissionOverwrites.edit(guild.id, { Connect: false });
                await interaction.editReply('🔒 A sala foi **bloqueada**. Apenas membros atuais ou convidados podem entrar agora.');
            }
            else if (subcommand === 'liberar') {
                await voiceChannel.permissionOverwrites.edit(guild.id, { Connect: null });
                await interaction.editReply('🔓 A sala foi **liberada**. Qualquer pessoa pode entrar novamente.');
            }
            else if (subcommand === 'transferir') {
                const novoDono = interaction.options.getUser('usuario');
                if (novoDono.id === member.id) return interaction.editReply('❌ Você já é o dono da sala.');
                
                await voiceChannel.permissionOverwrites.delete(member.id);
                await voiceChannel.permissionOverwrites.edit(novoDono.id, {
                    ManageChannels: true, ManageRoles: true, MoveMembers: true, Connect: true, Speak: true
                });

                TempVoiceService.activeChannels.set(voiceChannel.id, novoDono.id);
                await TempVoiceService.saveDb();

                await interaction.editReply(`✅ Posse da sala transferida para ${novoDono.toString()}.`);
            }
            else if (subcommand === 'expulsar') {
                const alvo = interaction.options.getMember('usuario');
                if (!alvo || !alvo.voice.channel || alvo.voice.channel.id !== voiceChannel.id) {
                    return interaction.editReply('❌ Este usuário não está na sua sala de voz.');
                }
                if (alvo.id === member.id) return interaction.editReply('❌ Você não pode se expulsar.');

                await alvo.voice.disconnect('Expulso pelo dono da sala temporária.');
                await voiceChannel.permissionOverwrites.edit(alvo.id, { Connect: false });
                await interaction.editReply(`✅ O usuário ${alvo.toString()} foi expulso e bloqueado de voltar.`);
            }
            else if (subcommand === 'info') {
                const donoId = TempVoiceService.getOwner(voiceChannel.id);
                const limitStr = voiceChannel.userLimit === 0 ? 'Ilimitado' : `${voiceChannel.members.size}/${voiceChannel.userLimit}`;
                await interaction.editReply(`ℹ️ **Informações da Sala**\nDono: <@${donoId}>\nNome: ${voiceChannel.name}\nMembros: ${limitStr}`);
            }
            else if (subcommand === 'convidar') {
                const alvo = interaction.options.getMember('usuario');
                if (!alvo) return interaction.editReply('❌ Usuário inválido.');
                await voiceChannel.permissionOverwrites.edit(alvo.id, { Connect: true, ViewChannel: true });
                await interaction.editReply(`✅ ${alvo.toString()} foi convidado e agora tem acesso garantido à sua sala.`);
            }
            else if (subcommand === 'privado') {
                await voiceChannel.permissionOverwrites.edit(guild.id, { ViewChannel: false });
                await interaction.editReply('👻 A sala agora está **invisível (privada)**. Apenas quem já está nela ou foi convidado pode vê-la.');
            }
            else if (subcommand === 'publico') {
                await voiceChannel.permissionOverwrites.edit(guild.id, { ViewChannel: null, Connect: null });
                await interaction.editReply('🌍 A sala agora está **pública**. Todos podem vê-la e entrar.');
            }
        } catch (error) {
            logger.error(`Erro no comando de gerenciar sala: ${error.message}`);
            await interaction.editReply(`❌ Ocorreu um erro ao modificar a sala: ${error.message}`);
        }
    },
};