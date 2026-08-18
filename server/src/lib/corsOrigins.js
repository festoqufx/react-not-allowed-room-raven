export const parseAllowedOrigins = (value) => {
    if (!value) return ['*'];

    try {
        let corsValue = String(value).trim();
        if (corsValue.startsWith('[') && corsValue.endsWith(']')) {
            corsValue = corsValue.slice(1, -1);
        }

        return corsValue.split(',').map((origin) => (
            origin.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '')
        ));
    } catch {
        return String(value).split(',').map((origin) => origin.trim().replace(/\/$/, ''));
    }
};

export const isDevOrigin = (origin = '') => (
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)
);

export const isAllowedOrigin = (origin, allowedOrigins = ['*']) => (
    !origin ||
    allowedOrigins.includes('*') ||
    allowedOrigins.includes(origin) ||
    isDevOrigin(origin)
);
