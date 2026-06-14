import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('vincular')
        .setDescription('Vincula sua conta de um jogo para receber seu Rank Real automaticamente.')
        .addSubcommand(sub => sub
            .setName('valorant')
            .setDescription('Verifica seu Elo atual e te dá um cargo correspondente.')
            .addStringOption(opt => opt
                .setName('riot_id')
                .setDescription('Seu Riot ID (Ex: Polaris#BR1)')
                .setRequired(true)
            )
        ),
    accessLevel: 1,
    cooldown: 10,
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 }); // Ephemeral (Oculto)
        
        const sub = interaction.options.getSubcommand();
        if (sub === 'valorant') {
            const riotId = interaction.options.getString('riot_id');
            const parts = riotId.split('#');
            if (parts.length !== 2) {
                return interaction.editReply('❌ Formato inválido! Use o formato Nome#Tag (Ex: Polaris#BR1).');
            }

            const [name, tag] = parts;

            try {
                // Comunicação ao vivo com a API de Valorant
                const response = await fetch(`https://api.henrikdev.xyz/valorant/v1/mmr/br/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
                const data = await response.json();

                if (data.status !== 200 || !data.data) {
                    return interaction.editReply(`❌ Jogador não encontrado. Verifique se o Riot ID está exato (Maiúsculas importam).`);
                }

                const rankName = data.data.currenttierpatched; // Ex: "Gold 2", "Platinum 1"
                if (!rankName) {
                    return interaction.editReply('❌ Conta encontrada, mas você ainda não possui um rank nesta season (Unranked).');
                }

                // Tradução do Elo para pegar a cor e o cargo
                let roleName = 'Unranked'; let roleColor = '#ffffff';
                if (rankName.includes('Iron')) { roleName = 'Ferro'; roleColor = '#5e5e5e'; }
                else if (rankName.includes('Bronze')) { roleName = 'Bronze'; roleColor = '#b08d55'; }
                else if (rankName.includes('Silver')) { roleName = 'Prata'; roleColor = '#c1c1c1'; }
                else if (rankName.includes('Gold')) { roleName = 'Ouro'; roleColor = '#f1c40f'; }
                else if (rankName.includes('Platinum')) { roleName = 'Platina'; roleColor = '#00a8ff'; }
                else if (rankName.includes('Diamond')) { roleName = 'Diamante'; roleColor = '#9b59b6'; }
                else if (rankName.includes('Ascendant')) { roleName = 'Ascendente'; roleColor = '#2ecc71'; }
                else if (rankName.includes('Immortal')) { roleName = 'Imortal'; roleColor = '#e74c3c'; }
                else if (rankName.includes('Radiant')) { roleName = 'Radiante'; roleColor = '#fffa65'; }

                const guild = interaction.guild;
                const fullRoleName = `Valorant ${roleName}`;
                
                // Cria o cargo do Elo se ele ainda não existir no servidor
                let role = guild.roles.cache.find(r => r.name === fullRoleName);
                if (!role) role = await guild.roles.create({ name: fullRoleName, color: roleColor, reason: 'Sistema Automático de Ranks', hoist: true });

                // Remove Elos antigos se o usuário for rebaixado/subir e dá o novo
                const oldRoles = interaction.member.roles.cache.filter(r => r.name.startsWith('Valorant ') && r.name !== fullRoleName);
                if (oldRoles.size > 0) await interaction.member.roles.remove(oldRoles);
                await interaction.member.roles.add(role);

                const embed = new EmbedBuilder().setColor(roleColor).setTitle('🎮 Conta Vinculada com Sucesso!').setDescription(`Seu Riot ID **${riotId}** foi verificado.`).addFields({ name: 'Elo Atual', value: rankName, inline: true }, { name: 'Cargo Recebido', value: `<@&${role.id}>`, inline: true }).setThumbnail('https://i.imgur.com/8QG3mQ9.png');
                await interaction.editReply({ embeds: [embed] });
                
                const geralChannel = guild.channels.cache.find(c => c.name.includes('geral') || c.name.includes('chat'));
                if (geralChannel) geralChannel.send(`🎖️ O membro ${interaction.member.toString()} vinculou a conta do Valorant e é oficialmente **${roleName}**!`).catch(()=>{});
            } catch (error) {
                await interaction.editReply('❌ Houve um erro ao se comunicar com os servidores da Riot Games. Tente novamente mais tarde.');
            }
        }
    }
};