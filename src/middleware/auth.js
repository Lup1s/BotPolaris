import { logger } from '../utils/logger.js';

/**
 * Níveis de Acesso:
 * 1: Usuários comuns
 * 2: Staff
 * 3: Administradores
 * 4: Fundadores
 * 5: Owner do Bot
 */

export const checkAuth = (interaction, command) => {
    // Se o comando não exige nível específico, liberado.
    if (!command.accessLevel) return true;

    const userId = interaction.user.id;
    const isOwner = userId === process.env.OWNER_ID;

    // Se exige Nível 5 (Owner), verifica rigorosamente.
    if (command.accessLevel === 5) {
        if (!isOwner) {
            logger.security(`Tentativa de acesso negada ao Nível 5 (Owner) pelo usuário ${interaction.user.tag} (${userId}) no comando /${command.data.name}`);
            interaction.reply({ content: '🚫 Acesso Negado. Este comando é restrito ao Owner do Bot.', flags: 64 });
            return false;
        }
        return true;
    }

    // Se for Owner, pode acessar tudo
    if (isOwner) return true;

    // TODO: Implementar lógica de verificação para os níveis 2, 3 e 4 via Cargos/Permissões no Servidor.
    // Como simplificação inicial, estamos exigindo permissão de Administrador para Níveis 3 e 4.
    const member = interaction.member;
    const hasAdmin = member?.permissions?.has('Administrator');

    if (command.accessLevel >= 3 && !hasAdmin) {
        logger.security(`Acesso negado ao Nível ${command.accessLevel} pelo usuário ${interaction.user.tag} (${userId}) no comando /${command.data.name}`);
        interaction.reply({ content: `🚫 Acesso Negado. Este comando requer nível de acesso ${command.accessLevel}.`, ephemeral: true });
        return false;
    }

    return true;
};
