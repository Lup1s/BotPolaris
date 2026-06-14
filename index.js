import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { CommandManager } from './src/managers/CommandManager.js';
import { EventManager } from './src/managers/EventManager.js';
import { logger } from './src/utils/logger.js';
import { validateEnv } from './src/config/env.js';

import { SystemMessageService } from './src/services/SystemMessageService.js';
import { LevelingService } from './src/services/LevelingService.js';
import { StatsService } from './src/services/StatsService.js';
import { TempVoiceService } from './src/services/TempVoiceService.js';

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
        logger.info('Iniciando o BotPolaris...');
        
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
