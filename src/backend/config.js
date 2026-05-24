export const DEFAULT_USER = 'testUser';
export const DEFAULT_IMGAPI = 'https://api.xinac.net/icon/?url=';

export const DEFAULT_CONFIG = {
    MAX_BACKUPS: 10,
    MIN_BACKUP_INTERVAL_MS: 10 * 60 * 1000,
    ACCESS_TOKEN_EXPIRY: 7200,
    REFRESH_TOKEN_EXPIRY: 2592000,
    ICON_CACHE_MAX_AGE: 604800,
    HTML_CACHE_MAX_AGE: 3600,
};

export function getConfig(env, key) {
    if (env[key] !== undefined) {
        const val = env[key];
        const num = parseInt(val, 10);
        return isNaN(num) ? val : num;
    }
    return DEFAULT_CONFIG[key];
}
