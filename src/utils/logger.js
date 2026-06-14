import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Garantir que a pasta logs exista
const logDir = path.resolve('src', 'logs');
if (!fsSync.existsSync(logDir)) {
    fsSync.mkdirSync(logDir, { recursive: true });
}

class Logger {
    constructor() {
        this.logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
    }

    async _write(level, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

        // Log no console
        if (level === 'error') {
            console.error(logEntry.trim());
        } else if (level === 'warn') {
            console.warn(logEntry.trim());
        } else {
            console.log(logEntry.trim());
        }

        // Log no arquivo
        try {
            await fs.appendFile(this.logFile, logEntry, 'utf8');
        } catch (error) {
            console.error(`[LOGGER ERROR] Falha ao escrever no arquivo de log: ${error.message}`);
        }
    }

    info(message) {
        return this._write('info', message);
    }

    warn(message) {
        return this._write('warn', message);
    }

    error(message) {
        return this._write('error', message);
    }
    
    security(message) {
        return this._write('security', message);
    }
}

export const logger = new Logger();
