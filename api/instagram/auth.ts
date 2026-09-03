import { appendSetCookie, buildAuthorizationUrl, createOauthState, secureCookie, sendJson } from '../_lib/instagram';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const { nonce, state } = createOauthState();
    appendSetCookie(res, secureCookie('ig_oauth_state', nonce, 10 * 60));
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, buildAuthorizationUrl(state));
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to start Instagram login' });
  }
}
