import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { ChannelType } from 'discord.js';
import { logger } from '../utils/logger.js';

export class BackupService {
    static backupsDir = path.resolve('src', 'backups');

    /**
     * Cria um backup completo da guilda (cargos, categorias e canais)
     * @param {Guild} guild A guilda do Discord
     * @param {boolean} isAuto Se é um backup automático disparado pelo sistema
     */
    static async createBackup(guild, isAuto = false) {
        try {
            if (!guild) throw new Error('Guild inválida para backup.');

            // Certificar que o diretório de backups da guilda existe
            const guildBackupDir = path.join(this.backupsDir, guild.id);
            if (!fsSync.existsSync(guildBackupDir)) {
                await fs.mkdir(guildBackupDir, { recursive: true });
            }

            // Buscar e mapear cargos
            const roles = guild.roles.cache.map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                permissions: role.permissions.bitfield.toString(),
                position: role.position,
                mentionable: role.mentionable
            }));

            // Buscar e mapear canais e categorias
            const categories = [];
            const channels = [];

            guild.channels.cache.forEach(channel => {
                const permissionOverwrites = channel.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    type: overwrite.type, // 0 para Role, 1 para Member
                    allow: overwrite.allow.bitfield.toString(),
                    deny: overwrite.deny.bitfield.toString()
                }));

                if (channel.type === ChannelType.GuildCategory) {
                    categories.push({
                        id: channel.id,
                        name: channel.name,
                        position: channel.position,
                        permissions: permissionOverwrites
                    });
                } else {
                    channels.push({
                        id: channel.id,
                        type: channel.type,
                        name: channel.name,
                        parentId: channel.parentId,
                        position: channel.position,
                        nsfw: channel.nsfw || false,
                        topic: channel.topic || null,
                        permissions: permissionOverwrites
                    });
                }
            });

            const backupData = {
                guildId: guild.id,
                name: guild.name,
                timestamp: new Date().toISOString(),
                isAuto: isAuto,
                roles,
                categories,
                channels
            };

            // Formata o timestamp substituindo os dois-pontos para evitar caracteres inválidos no Windows
            const formattedTimestamp = backupData.timestamp.replace(/:/g, '-');
            const filename = `${isAuto ? 'auto' : 'manual'}_backup_${formattedTimestamp}.json`;
            const filepath = path.join(guildBackupDir, filename);

            await fs.writeFile(filepath, JSON.stringify(backupData, null, 4), 'utf8');
            logger.info(`Backup ${isAuto ? 'automático' : 'manual'} do servidor ${guild.name} (${guild.id}) gerado com sucesso: ${filename}`);

            return filename;
        } catch (error) {
            logger.error(`Erro ao criar backup do servidor: ${error.message}`);
            throw error;
        }
    }

    /**
     * Lista todos os backups disponíveis para um servidor
     * @param {string} guildId ID do servidor
     */
    static async listBackups(guildId) {
        try {
            const guildBackupDir = path.join(this.backupsDir, guildId);
            if (!fsSync.existsSync(guildBackupDir)) return [];

            const files = await fs.readdir(guildBackupDir);
            const backupFiles = files.filter(f => f.endsWith('.json'));

            const list = [];
            for (const file of backupFiles) {
                const filepath = path.join(guildBackupDir, file);
                const stat = await fs.stat(filepath);
                list.push({
                    filename: file,
                    createdAt: stat.birthtime || stat.mtime,
                    sizeBytes: stat.size
                });
            }

            // Ordena do mais recente para o mais antigo
            return list.sort((a, b) => b.createdAt - a.createdAt);
        } catch (error) {
            logger.error(`Erro ao listar backups para guilda ${guildId}: ${error.message}`);
            return [];
        }
    }
}
