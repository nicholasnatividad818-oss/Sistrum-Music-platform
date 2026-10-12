// Reads configuration from the environment. Secret values are never logged or rendered.
export function loadConfig(env = process.env) {
  const baseUrl = (env.BASE_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/+$/, '');
  const kick = {
    clientId: env.KICK_CLIENT_ID || '',
    clientSecret: env.KICK_CLIENT_SECRET || '',
    redirectUri: env.KICK_REDIRECT_URI || `${baseUrl}/auth/kick/callback`,
    authorizeUrl: env.KICK_AUTHORIZE_URL || 'https://id.kick.com/oauth/authorize',
    tokenUrl: env.KICK_TOKEN_URL || 'https://id.kick.com/oauth/token',
    revokeUrl: env.KICK_REVOKE_URL || 'https://id.kick.com/oauth/revoke',
    userUrl: env.KICK_USER_URL || 'https://api.kick.com/public/v1/users',
    scope: 'user:read',
  };
  const sessionSecret = env.SESSION_SECRET || '';
  return {
    port: Number(env.PORT || 8787),
    baseUrl,
    origin: new URL(baseUrl).origin,
    secureCookies: baseUrl.startsWith('https://'),
    databasePath: env.DATABASE_PATH || 'viewerworks.db',
    sessionSecret,
    kick,
    kickConfigured: Boolean(kick.clientId && kick.clientSecret && sessionSecret),
    missingKickVars: [
      ['KICK_CLIENT_ID', kick.clientId],
      ['KICK_CLIENT_SECRET', kick.clientSecret],
      ['SESSION_SECRET', sessionSecret],
    ].filter(([, value]) => !value).map(([name]) => name),
  };
}
