import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionsBitField } from 'discord.js';

export default {
    accessLevel: 3, // Nível 3: Apenas Administradores podem usar
    data: new SlashCommandBuilder()
        .setName('setup-registro')
        .setDescription('Cria a mensagem interativa para registro de jogos e cargos.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
        
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#89b4fa') // Cor temática do bot
            .setTitle('🎮 Escolha seus Jogos')
            .setDescription('Selecione abaixo os jogos que você joga para receber as tags correspondentes. Assim, você será notificado quando a galera for jogar!')
            .setFooter({ text: 'Você pode escolher mais de um jogo no menu abaixo.' });

        const select = new StringSelectMenuBuilder()
            .setCustomId('select_games')
            .setPlaceholder('Clique aqui para selecionar...')
            .setMinValues(0) // O usuário pode desmarcar tudo se quiser
            .setMaxValues(4) // Quantidade máxima de opções que ele pode escolher
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('CS2').setValue('role_cs2').setEmoji('🔫'),
                new StringSelectMenuOptionBuilder().setLabel('Valorant').setValue('role_valorant').setEmoji('🔴'),
                new StringSelectMenuOptionBuilder().setLabel('League of Legends').setValue('role_lol').setEmoji('⚔️'),
                new StringSelectMenuOptionBuilder().setLabel('Minecraft').setValue('role_minecraft').setEmoji('⛏️')
            );

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Painel de registro criado com sucesso!', flags: 64 });
    }
};