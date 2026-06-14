import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Instancia o SDK do Gemini (certifique-se de ter GEMINI_API_KEY no seu arquivo .env)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'SUA_CHAVE_AQUI');

const data = new SlashCommandBuilder()
    .setName('ia')
    .setDescription('[ADMIN] Peça para a Inteligência Artificial mudar algo ou gerar conteúdo para o servidor.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(option => 
        option.setName('pedido')
            .setDescription('O que você quer que a IA faça ou responda?')
            .setRequired(true)
    );

async function execute(interaction) {
    // Comando exclusivo para administradores
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', flags: 64 });
    }

    const pedido = interaction.options.getString('pedido');
    await interaction.deferReply({ flags: 64 }); // Resposta efêmera (só o admin vê)

    if (!process.env.GEMINI_API_KEY) {
        return interaction.editReply('❌ A chave `GEMINI_API_KEY` não está configurada no seu arquivo `.env`.');
    }

    try {
        // Usa o modelo gemini-1.5-flash (mais rápido e ideal para conversas/tarefas textuais)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const promptContext = `Você é o assistente IA administrador do servidor de Discord "Polaris".
Você está falando com um Administrador.
Ele pediu: "${pedido}"

Responda de forma clara, direta e útil. Se for um pedido para escrever um aviso, regras, ou lore, gere o texto pronto para ser copiado e colado. Se for uma dúvida técnica, responda com precisão.`;

        const result = await model.generateContent(promptContext);
        const responseText = result.response.text();

        // O Discord tem limite de 4096 caracteres em embeds e 2000 em mensagens normais.
        // Vamos usar um Embed para ficar mais bonito.
        const embed = new EmbedBuilder()
            .setColor('#89b4fa')
            .setTitle('🤖 Assistente IA Polaris')
            .setDescription(responseText.substring(0, 4096))
            .setFooter({ text: 'Gerado pelo Gemini AI' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(`Erro no comando /ia: ${error.message}`);
        await interaction.editReply('❌ Houve um erro ao processar seu pedido com a IA. Tente novamente mais tarde.');
    }
}

export default { data, execute };
