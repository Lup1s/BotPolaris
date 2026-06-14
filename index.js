import 'dotenv/config';
import http from 'http';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { CommandManager } from './src/managers/CommandManager.js';
import { EventManager } from './src/managers/EventManager.js';
import { logger } from './src/utils/logger.js';
import { validateEnv } from './src/config/env.js';

import { SystemMessageService } from './src/services/SystemMessageService.js';
import { LevelingService } from './src/services/LevelingService.js';
import { StatsService } from './src/services/StatsService.js';
import { TempVoiceService } from './src/services/TempVoiceService.js';

// 0. Servidor HTTP para satisfazer a verificação de porta do Render
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('BotPolaris Online!\n');
}).listen(port);

// 1. Validar as variáveis de ambiente
validateEnv();

// 2. Inicializar o cliente com as intenções necessárias para administração
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Armazenar comandos no cliente
client.commands = new Collection();
client.cooldowns = new Collection();

// 3. Inicializar gerenciadores
const bootstrap = async () => {
    try {
        logger.info(`Iniciando o BotPolaris... (Servidor Web na porta ${port})`);
        
        await CommandManager.loadCommands(client);
        await EventManager.loadEvents(client);
        
        // Iniciar serviços quando o bot estiver logado
        client.once(Events.ClientReady, async () => {
            await SystemMessageService.init(client);
            await LevelingService.init(client);
            await TempVoiceService.init(client);
            StatsService.startAutoUpdate(client);
        });

        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        logger.error(`Erro fatal ao iniciar o bot: ${error.message}`);
        process.exit(1);
    }
};

bootstrap();
