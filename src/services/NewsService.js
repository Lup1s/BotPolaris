import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';
import { SystemMessageService } from './SystemMessageService.js';

export class NewsService {
    // Na versão final, isso consultará APIs reais (RSS/Twitter/Sites Oficiais)
    static async startMonitoring(client) {
        logger.info('Sistema de Inteligência de Notícias (Curadoria) iniciado.');
        
        // Exemplo: Dispara verificações a cada hora
        setInterval(() => this.checkUpdates(client), 60 * 60 * 1000);
    }

    static async checkUpdates(client) {
        // Simulando que encontrou um "Patch Notes" de Valorant
        const mockNews = {
            game: 'Valorant',
            title: 'Notas da Atualização 8.04',
            summary: 'O Premier ganha novos recursos de integração de esquadrões e o modo MME sofre balanceamento nos respawns.',
            impact: '🔴 Alta Relevância',
            readTime: '45 segundos',
            link: 'https://playvalorant.com/'
        };
        
        // publicaria a noticia...
    }

    static async publishCuratedNews(guild, newsData) {
        const channelId = SystemMessageService.config.channels.noticias;
        if (!channelId) return;
        const channel = guild.channels.cache.get(channelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(newsData.impact.includes('Alta') ? '#e74c3c' : '#f1c40f')
            .setAuthor({ name: `📡 Inteligência de Operações: ${newsData.game}` })
            .setTitle(newsData.title)
            .setDescription(`**Impacto:** ${newsData.impact} | **Leitura:** ⏳ ${newsData.readTime}\n\n**Resumo Estratégico:**\n${newsData.summary}`)
            .setImage('https://i.imgur.com/example_banner.jpg') // Banner oficial do patch
            .setFooter({ text: 'Curadoria Automática Polaris' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Ler Completo').setStyle(ButtonStyle.Link).setURL(newsData.link),
            new ButtonBuilder().setCustomId('news_discuss').setLabel('Criar Fórum de Debate').setStyle(ButtonStyle.Secondary).setEmoji('💬')
        );

        // Só pinga se for de ALTA relevância
        const role = guild.roles.cache.find(r => r.name === `Jogador de ${newsData.game}`);
        const content = (role && newsData.impact.includes('Alta')) ? role.toString() : null;

        await channel.send({ content, embeds: [embed], components: [row] });
    }
}