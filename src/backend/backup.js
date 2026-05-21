import { DEFAULT_USER, getConfig } from './config.js';
import { logError } from './utils.js';

const MIN_BACKUP_INTERVAL_MS = 10 * 60 * 1000;

export async function handleSmartBackup(env, currentData) {
    const maxBackups = getConfig(env, 'MAX_BACKUPS');

    try {
        const list = await env.CARD_ORDER.list({ prefix: `backup_${DEFAULT_USER}_` });
        let keys = list.keys;

        keys.sort((a, b) => a.name.localeCompare(b.name));

        let shouldBackup = true;

        if (keys.length > 0) {
            const lastBackupMeta = keys[keys.length - 1].metadata;
            if (lastBackupMeta && lastBackupMeta.timestamp) {
                const timeDiff = Date.now() - lastBackupMeta.timestamp;
                if (timeDiff < MIN_BACKUP_INTERVAL_MS) {
                    shouldBackup = false;
                }
            }
        }

        if (shouldBackup) {
            const now = Date.now();
            const date = new Date(now + 8 * 3600 * 1000);
            const dateStr = date.toISOString().replace(/[:.]/g, '-');
            const backupKey = `backup_${DEFAULT_USER}_${dateStr}`;

            await env.CARD_ORDER.put(backupKey, currentData, {
                metadata: { timestamp: now }
            });

            if (keys.length >= maxBackups) {
                const deleteCount = keys.length + 1 - maxBackups;
                if (deleteCount > 0) {
                    const toDelete = keys.slice(0, deleteCount);
                    for (const key of toDelete) {
                        await env.CARD_ORDER.delete(key.name);
                    }
                }
            }
        }
    } catch (e) {
        logError("handleSmartBackup", e);
    }
}
