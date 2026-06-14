import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { REST, Routes } from 'discord.js';
import { logger } from '../utils/logger.js';

export class CommandManager {
    static async loadCommands(client) {
        const commandsPath = path.resolve('src', 'commands');
        let commandArray = [];
        let loadedCount = 0;

        try {
            const categories = await fs.readdir(commandsPath);

            for (const category of categories) {
                const categoryPath = path.join(commandsPath, category);
                const stat = await fs.stat(categoryPath);

                if (!stat.isDirectory()) continue;

                const commandFiles = await fs.readdir(categoryPath);
                
                for (const file of commandFiles) {
                    if (!file.endsWith('.js')) continue;

                    const filePath = path.join(categoryPath, file);
                    const fileUrl = pathToFileURL(filePath).href;
                    
                    try {
                        const module = await import(fileUrl);
                        const command = module.default;

                        if ('data' in command && 'execute' in command) {
                            client.commands.set(command.data.name, command);
                            commandArray.push(command.data.toJSON());
                            loadedCount++;
                        } else {
                            logger.warn(`O comando em ${filePath} está faltando a propriedade "data" ou "execute" requerida.`);
                        }
                    } catch (err) {
                        logger.error(`Erro ao carregar o comando ${filePath}: ${err.message}`);
                    }
                }
            }

            logger.info(`${loadedCount} comandos carregados com sucesso.`);

            // Registrar comandos na API do Discord
            if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
                const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
                logger.info('Iniciando o registro de slash commands da aplicação (/)');
                
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commandArray }
                );
                
                logger.info('Slash commands registrados com sucesso na API do Discord.');
            }

        } catch (error) {
            logger.error(`Erro crítico no CommandManager: ${error.message}`);
        }
    }
}
