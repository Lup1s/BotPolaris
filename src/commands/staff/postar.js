import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SystemMessageService } from '../../services/SystemMessageService.js';
import { logger } from '../../utils/logger.js';

// Inicializa a IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'SUA_CHAVE_AQUI');

export default {
    accessLevel: 2, // Staff
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('postar')
        .setDescription('[STAFF] Cria posts formatados nos canais informativos.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
        .addSubcommand(sub => sub
            .setName('aviso')
            .setDescription('Posta um aviso técnico/administrativo oficial no canal de Avisos.')
            .addStringOption(opt => opt.setName('titulo').setDescription('Título do aviso').setRequired(true))
            .addStringOption(opt => opt.setName('conteudo').setDescription('Texto principal do aviso (use \\n para quebrar linha)').setRequired(true))
            .addStringOption(opt => opt.setName('cor').setDescription('Cor lateral do aviso').setRequired(false)
                .addChoices(
                    { name: '🔴 Vermelho (Urgente)', value: '#e74c3c' },
                    { name: '🟡 Amarelo (Atenção)', value: '#f1c40f' },
                    { name: '⚫ Cinza (Informativo)', value: '#2b2d31' }
                )
            )
            .addStringOption(opt => opt.setName('mencionar').setDescription('Mencionará alguém?').setRequired(false)
                .addChoices(
                    { name: 'everyone', value: 'everyone' },
                    { name: 'here', value: 'here' },
                    { name: 'nenhum', value: 'none' }
                )
            )
        )
        .addSubcommand(sub => sub
            .setName('anuncio')
            .setDescription('Posta um anúncio de comunidade no canal de Anúncios.')
            .addStringOption(opt => opt.setName('titulo').setDescription('Título do anúncio').setRequired(true))
            .addStringOption(opt => opt.setName('conteudo').setDescription('Conteúdo do anúncio (use \\n para quebra de linha)').setRequired(true))
            .addStringOption(opt => opt.setName('imagem').setDescription('URL de uma imagem ou banner').setRequired(false))
            .addStringOption(opt => opt.setName('cor').setDescription('Cor lateral do anúncio').setRequired(false)
                .addChoices(
                    { name: '🔵 Azul', value: '#00a8ff' },
                    { name: '🟢 Verde', value: '#2ecc71' },
                    { name: '🟣 Roxo', value: '#9b59b6' },
                    { name: '🌸 Rosa', value: '#fd79a8' }
                )
            )
            .addStringOption(opt => opt.setName('mencionar_jogo').setDescription('Marcar os jogadores de um jogo específico?').setRequired(false)
                .addChoices(
                    { name: 'CS2', value: 'CS2' },
                    { name: 'Valorant', value: 'Valorant' },
                    { name: 'League of Legends', value: 'LoL' },
                    { name: 'Minecraft', value: 'Minecraft' }
                )
            )
        )
        .addSubcommand(sub => sub
            .setName('noticia-ia')
            .setDescription('Resume uma notícia/patch notes com a IA Gemini e posta no canal de Notícias.')
            .addStringOption(opt => opt.setName('url').setDescription('URL do patch notes ou notícia').setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (subcommand === 'aviso') {
            await interaction.deferReply({ flags: 64 });
            const channelId = SystemMessageService.config.channels.avisos;
            if (!channelId) {
                return interaction.editReply('❌ O canal de avisos não está configurado. Use `/config-canais` primeiro.');
            }
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return interaction.editReply('❌ O canal de avisos configurado não foi encontrado no servidor.');

            const titulo = interaction.options.getString('titulo');
            const conteudo = interaction.options.getString('conteudo').replace(/\\n/g, '\n');
            const cor = interaction.options.getString('cor') || '#2b2d31';
            const mencionar = interaction.options.getString('mencionar') || 'none';

            const embed = new EmbedBuilder()
                .setColor(cor)
                .setAuthor({ name: '🛠️ ALERTA DE OPERAÇÕES POLARIS' })
                .setTitle(titulo)
                .setDescription(conteudo)
                .setTimestamp()
                .setFooter({ text: 'Informativo Oficial da Administração' });

            let content = null;
            if (mencionar === 'everyone') content = '@everyone';
            if (mencionar === 'here') content = '@here';

            await channel.send({ content, embeds: [embed] });
            await interaction.editReply('✅ Aviso publicado com sucesso!');
        }

        else if (subcommand === 'anuncio') {
            await interaction.deferReply({ flags: 64 });
            const channelId = SystemMessageService.config.channels.anuncios;
            if (!channelId) {
                return interaction.editReply('❌ O canal de anúncios não está configurado. Use `/config-canais` primeiro.');
            }
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return interaction.editReply('❌ O canal de anúncios configurado não foi encontrado no servidor.');

            const titulo = interaction.options.getString('titulo');
            const conteudo = interaction.options.getString('conteudo').replace(/\\n/g, '\n');
            const imagem = interaction.options.getString('imagem');
            const cor = interaction.options.getString('cor') || '#00a8ff';
            const mencionarJogo = interaction.options.getString('mencionar_jogo');

            const embed = new EmbedBuilder()
                .setColor(cor)
                .setAuthor({ name: '📢 DESTAQUE DA COMUNIDADE POLARIS' })
                .setTitle(titulo)
                .setDescription(conteudo)
                .setTimestamp()
                .setFooter({ text: 'Notificação Geral do Servidor' });

            if (imagem) {
                if (imagem.startsWith('http://') || imagem.startsWith('https://')) {
                    embed.setImage(imagem);
                } else {
                    return interaction.editReply('❌ Link de imagem inválido. Certifique-se de que começa com http:// ou https://');
                }
            }

            let content = null;
            if (mencionarJogo) {
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === `jogador de ${mencionarJogo.toLowerCase()}`);
                if (role) content = role.toString();
            }

            await channel.send({ content, embeds: [embed] });
            await interaction.editReply('✅ Anúncio publicado com sucesso!');
        }

        else if (subcommand === 'noticia-ia') {
            await interaction.deferReply({ flags: 64 });

            if (!process.env.GEMINI_API_KEY) {
                return interaction.editReply('❌ A chave `GEMINI_API_KEY` não está configurada no seu arquivo `.env`.');
            }

            const channelId = SystemMessageService.config.channels.noticias;
            if (!channelId) {
                return interaction.editReply('❌ O canal de notícias não está configurado. Use `/config-canais` primeiro.');
            }
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return interaction.editReply('❌ O canal de notícias configurado não foi encontrado no servidor.');

            const url = interaction.options.getString('url');
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return interaction.editReply('❌ URL inválida. Certifique-se de que começa com http:// ou https://');
            }

            await interaction.editReply('⏳ Lendo conteúdo do link e gerando resumo com a IA Gemini...');

            let bodyText = "";
            try {
                const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
                const html = await response.text();
                
                // Limpeza ultra básica de tags para pegar texto legível
                bodyText = html
                    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .substring(0, 6000);
            } catch (err) {
                logger.warn(`Não foi possível ler o link diretamente: ${err.message}. A IA tentará gerar com base nas informações do link.`);
            }

            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                
                const promptContext = `Você é o assistente IA curador de notícias do servidor de Discord "Polaris".
Você recebeu um link de notícia/patch notes: "${url}".
Abaixo está o conteúdo extraído da página (pode estar incompleto ou bruto):
"${bodyText}"

Faça uma análise inteligente desse patch notes ou notícia:
1. Crie um título chamativo e profissional para o Discord.
2. Diga qual é o jogo principal (CS2, Valorant, League of Legends, Minecraft, etc).
3. Avalie a relevância/impacto da notícia para os jogadores (Ex: "Alta Relevância", "Média Relevância", "Baixa Relevância").
4. Crie um resumo estratégico estruturado em bullet points com as principais mudanças.
5. Estime o tempo de leitura do artigo original.

Responda EXCLUSIVAMENTE em formato JSON com a seguinte estrutura para que eu possa fazer o parse:
{
  "game": "Nome do Jogo",
  "title": "Título da Notícia",
  "impact": "Alta Relevância / Média Relevância / Baixa Relevância",
  "readTime": "X segundos",
  "summary": "Resumo estruturado em tópicos...",
  "banner_keyword": "uma palavra em inglês para busca de imagem relacionada, ex: valorant, counterstrike, leagueoflegends"
}

Não adicione blocos de código markdown como \`\`\`json, responda apenas o JSON puro.`;

                const result = await model.generateContent(promptContext);
                let responseText = result.response.text().trim();
                
                // Tratar se a resposta do Gemini vier cercada por blocos de markdown
                if (responseText.startsWith('```')) {
                    responseText = responseText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
                }

                const newsData = JSON.parse(responseText);

                // Determinar cor do embed baseada no impacto
                let color = '#f1c40f'; // Amarelo
                if (newsData.impact.includes('Alta')) color = '#e74c3c'; // Vermelho
                if (newsData.impact.includes('Baixa')) color = '#2ecc71'; // Verde

                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setAuthor({ name: `📡 INTELIGÊNCIA DE OPERAÇÕES: ${newsData.game.toUpperCase()}` })
                    .setTitle(newsData.title)
                    .setDescription(`**Impacto:** ${newsData.impact} | **Leitura:** ⏳ ${newsData.readTime}\n\n**Resumo Estratégico:**\n${newsData.summary}`)
                    .setFooter({ text: 'Curadoria Automática Polaris | Gemini AI' })
                    .setThumbnail('https://i.imgur.com/8QG3mQ9.png') // Mascot/Logo do servidor
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Ler Completo').setStyle(ButtonStyle.Link).setURL(url)
                );

                // Pingar cargo do jogo correspondente se for de alta relevância
                let content = null;
                if (newsData.impact.includes('Alta')) {
                    const role = guild.roles.cache.find(r => r.name.toLowerCase() === `jogador de ${newsData.game.toLowerCase()}`);
                    if (role) content = role.toString();
                }

                const msg = await channel.send({ content, embeds: [embed], components: [row] });

                // Abre uma thread automática de debate sob a mensagem de notícia
                try {
                    await msg.startThread({
                        name: `Debate: ${newsData.title}`.substring(0, 100),
                        autoArchiveDuration: 1440,
                        reason: 'Fórum de debate de notícias'
                    });
                } catch (e) {
                    logger.warn(`Não foi possível criar thread de debate para notícia: ${e.message}`);
                }

                await interaction.editReply('✅ Notícia processada pela IA e publicada com sucesso com fórum de debate criado!');

            } catch (error) {
                console.error(`Erro ao processar notícia com Gemini: ${error.message}`);
                await interaction.editReply(`❌ Houve um erro ao processar seu pedido com a IA: ${error.message}. Tente novamente.`);
            }
        }
    }
};
