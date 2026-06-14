import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { logger } from '../utils/logger.js';

export class EventManager {
    static async loadEvents(client) {
        const eventsPath = path.resolve('src', 'events');
        let loadedCount = 0;

        try {
            // Criar pasta de eventos se não existir (apenas para estruturação no início)
            try {
                await fs.access(eventsPath);
            } catch {
                await fs.mkdir(eventsPath, { recursive: true });
            }

            const eventFiles = await fs.readdir(eventsPath);
            
            for (const file of eventFiles) {
                if (!file.endsWith('.js')) continue;

                const filePath = path.join(eventsPath, file);
                const fileUrl = pathToFileURL(filePath).href;

                try {
                    const module = await import(fileUrl);
                    const event = module.default;

                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args));
                    } else {
                        client.on(event.name, (...args) => event.execute(...args));
                    }
                    loadedCount++;
                } catch (err) {
                    logger.error(`Erro ao carregar o evento ${filePath}: ${err.message}`);
                }
            }

            logger.info(`${loadedCount} eventos carregados com sucesso.`);
        } catch (error) {
            logger.error(`Erro crítico no EventManager: ${error.message}`);
        }
    }
}
