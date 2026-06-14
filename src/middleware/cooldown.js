import { Collection } from 'discord.js';

// Cooldown padrão é 3 segundos
const DEFAULT_COOLDOWN = 3;

export const checkCooldown = (interaction, command) => {
    const { cooldowns } = interaction.client;

    if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || DEFAULT_COOLDOWN) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1000);
            interaction.reply({ content: `Por favor, espere, você está em cooldown para \`${command.data.name}\`. Tente novamente <t:${expiredTimestamp}:R>.`, flags: 64 });
            return false;
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    return true;
};
