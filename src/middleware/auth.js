import { PermissionsBitField } from 'discord.js';
import { logger } from '../utils/logger.js';

/**
 * Níveis de Acesso:
 * 1: Usuários comuns
 * 2: Staff (Moderadores e Suporte)
 * 3: Administradores
 * 4: Fundadores (Guild Owner e cargos de direção)
 * 5: Owner do Bot (Dono global no .env)
 */

export const getAccessLevelName = (level) => {
    switch (level) {
        case 1: return 'Usuário Comum';
        case 2: return 'Staff';
        case 3: return 'Administrador';
        case 4: return 'Fundador';
        case 5: return 'Owner do Bot';
        default: return 'Desconhecido';
    }
};

export const getUserAccessLevel = (member, guild) => {
    if (!member) return 1;

    const userId = member.id;

    // 1. Nível 5: Owner do Bot
    if (userId === process.env.OWNER_ID) return 5;

    // 2. Nível 4: Fundadores (Dono da guilda ou cargo com nome de Fundador/Dono/Diretor)
    const isGuildOwner = guild && guild.ownerId === userId;
    const hasFounderRole = member.roles.cache.some(role => {
        const name = role.name.toLowerCase();
        return name.includes('fundador') || name.includes('founder') || name.includes('diretor') || name.includes('dono');
    });
    if (isGuildOwner || hasFounderRole) return 4;

    // 3. Nível 3: Administradores (Permissão de Administrador ou cargo com nome Administrador/Admin)
    const hasAdminPermission = member.permissions.has(PermissionsBitField.Flags.Administrator);
    const hasAdminRole = member.roles.cache.some(role => {
        const name = role.name.toLowerCase();
        return name.includes('administrador') || name.includes('admin');
    });
    if (hasAdminPermission || hasAdminRole) return 3;

    // 4. Nível 2: Staff (Permissões de moderação ou cargo com nome Staff/Moderador/Mod/Suporte)
    const hasModPermissions = 
        member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
        member.permissions.has(PermissionsBitField.Flags.KickMembers) ||
        member.permissions.has(PermissionsBitField.Flags.BanMembers) ||
        member.permissions.has(PermissionsBitField.Flags.MuteMembers) ||
        member.permissions.has(PermissionsBitField.Flags.MoveMembers);

    const hasStaffRole = member.roles.cache.some(role => {
        const name = role.name.toLowerCase();
        return name.includes('staff') || name.includes('moderador') || name.includes('mod') || name.includes('suporte');
    });
    if (hasModPermissions || hasStaffRole) return 2;

    // 5. Nível 1: Usuários comuns
    return 1;
};

export const checkAuth = (interaction, command) => {
    // Se o comando não exige nível específico, liberado.
    if (!command.accessLevel) return true;

    const userLevel = getUserAccessLevel(interaction.member, interaction.guild);

    if (userLevel < command.accessLevel) {
        logger.security(`Acesso negado ao Nível ${command.accessLevel} (${getAccessLevelName(command.accessLevel)}) pelo usuário ${interaction.user.tag} (${interaction.user.id}) no comando /${command.data.name} (Nível do Usuário: ${userLevel})`);
        
        const errorMessage = `🚫 **Acesso Negado.** Este comando requer o nível de acesso **${command.accessLevel} (${getAccessLevelName(command.accessLevel)})**.\nSeu nível atual é **${userLevel} (${getAccessLevelName(userLevel)})**.`;
        
        interaction.reply({ content: errorMessage, flags: 64 });
        return false;
    }

    return true;
};
