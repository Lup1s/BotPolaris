import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('mix')
        .setDescription('Inicia um lobby para partida customizada (Sorteia os times e move pra call).')
        .addStringOption(opt => opt.setName('jogo')
            .setDescription('Qual jogo será o Mix?')
            .setRequired(true)
            .addChoices(
                { name: 'Valorant (10v10)', value: 'Valorant' },
                { name: 'CS2 (10v10)', value: 'CS2' },
                { name: 'LoL (10v10)', value: 'League of Legends' }
            )
        )
        .addIntegerOption(opt => opt.setName('tamanho')
            .setDescription('Tamanho da sala (Padrão: 10). Útil para testes rápidos.')
            .setMinValue(2).setMaxValue(20).setRequired(false)
        ),
    accessLevel: 1,
    cooldown: 10,
    async execute(interaction) {
        const jogo = interaction.options.getString('jogo');
        const tamanho = interaction.options.getInteger('tamanho') || 10;
        const member = interaction.member;

        const embed = new EmbedBuilder()
            .setColor('#a6e3a1')
            .setTitle(`🏆 Mix de ${jogo}`)
            .setDescription(`Clique no botão abaixo para entrar na fila do Mix!\n\nQuando a fila atingir **${tamanho} jogadores**, os times serão sorteados magicamente e o bot irá puxar todos vocês para as calls de voz.`)
            .addFields({ name: `👥 Jogadores (1/${tamanho})`, value: member.toString(), inline: false })
            .setFooter({ text: `Status: Aguardando jogadores... | Vagas: ${tamanho}` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mix_join').setLabel('Entrar no Mix').setStyle(ButtonStyle.Success).setEmoji('🎮'),
            new ButtonBuilder().setCustomId('mix_leave').setLabel('Sair').setStyle(ButtonStyle.Danger).setEmoji('🚪')
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};