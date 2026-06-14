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
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
    ]
});

// Armazenar comandos no cliente
client.commands = new Collection();
client.cooldowns = new Collection();

// 2.5. Servidor Web Interno (Dashboard de Monitoramento)
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    if (req.url === '/') {
        const logs = logger.recentLogs || [];
        const isReady = client.isReady();
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>BotPolaris - Monitor</title>
                <style>
                    body { font-family: system-ui, sans-serif; background: #1e1e2e; color: #cdd6f4; margin: 0; padding: 20px; }
                    h1 { color: #89b4fa; }
                    .card { background: #313244; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .logs { background: #11111b; padding: 15px; border-radius: 8px; height: 500px; overflow-y: auto; font-family: monospace; font-size: 14px; }
                    .log-info { color: #a6e3a1; }
                    .log-warn { color: #f9e2af; }
                    .log-error { color: #f38ba8; font-weight: bold; }
                </style>
                <meta http-equiv="refresh" content="10">
            </head>
            <body>
                <h1>🌌 BotPolaris Dashboard</h1>
                <div class="card">
                    <p><strong>Status do Bot:</strong> ${isReady ? '🟢 Online' : '🟡 Iniciando...'}</p>
                    <p><strong>Ping da API:</strong> ${isReady ? client.ws.ping + 'ms' : '---'}</p>
                    <p><strong>Servidores conectados:</strong> ${isReady ? client.guilds.cache.size : '---'}</p>
                </div>
                <h2>Terminal de Logs (Atualiza a cada 10s)</h2>
                <div class="logs" id="logBox">${
                    logs.map(log => {
                        let colorClass = 'log-info';
                        if (log.includes('[WARN]')) colorClass = 'log-warn';
                        if (log.includes('[ERROR]')) colorClass = 'log-error';
                        return `<div class="${colorClass}">${log}</div>`;
                    }).join('')
                }</div>
                <script>document.getElementById('logBox').scrollTop = 9999999;</script>
            </body>
            </html>
        `);
    } else { res.writeHead(200); res.end('OK'); }
}).listen(port);

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
