import { Events, EmbedBuilder } from 'discord.js';
import { LevelingService } from '../services/LevelingService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        if (member.user.bot) return; // Ignora se quem entrou for outro bot

        try {
            // 1. Dá o cargo inicial militar (Nível 1 - Recruta)
            // O método updateMilitaryRole já cria o cargo se ele não existir
            await LevelingService.updateMilitaryRole(member, 1);

            // 2. Procura um canal para mandar as boas-vindas
            // Ele vai procurar por canais com esses nomes. Você pode alterar para o nome exato do seu canal.
            const welcomeChannel = member.guild.channels.cache.find(
                c => c.name === 'boas-vindas' || c.name === 'chat-geral' || c.name === 'geral' || c.name === 'recepção'
            );

            if (welcomeChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#89b4fa') // Cor azul temática
                    .setTitle(`🎉 Bem-vindo(a) à Base, ${member.user.username}!`)
                    .setDescription(`Olá, ${member.toString()}! Você acaba de se alistar como **🪖 Recruta** em nossa comunidade.\n\n💬 Converse no chat e participe das calls de voz para ganhar XP e subir de patente!`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({ text: `Agora somos ${member.guild.memberCount} membros!` })
                    .setTimestamp();

                await welcomeChannel.send({ embeds: [embed] });
            }

            logger.info(`Novo membro alistado: ${member.user.tag}. Auto-role [Recruta] aplicado.`);
        } catch (error) {
            logger.error(`Erro no evento de boas-vindas (guildMemberAdd): ${error.message}`);
        }
    }
};