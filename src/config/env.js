import fs from 'fs';
import path from 'path';

export const validateEnv = () => {
    const requiredEnvVars = [
        'DISCORD_TOKEN',
        'CLIENT_ID',
        'OWNER_ID',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY'
    ];

    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingVars.length > 0) {
        console.error(`[ERRO CRÍTICO] Variáveis de ambiente ausentes: ${missingVars.join(', ')}`);
        console.error('Por favor, configure o arquivo .env baseado no .env.example');
        process.exit(1);
    }
};
