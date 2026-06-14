import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.info(`Pronto! Logado como ${client.user.tag}`);
        client.user.setActivity('Administrando Polaris');
    },
};
