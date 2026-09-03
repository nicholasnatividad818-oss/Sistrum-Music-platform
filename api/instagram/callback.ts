import {
  appendSetCookie,
  clearCookie,
  exchangeAuthorizationCode,
  exchangeLongLivedToken,
  getProfile,
  getQueryValue,
  parseCookies,
  secureCookie,
  sendJson,
  verifyOauthState
} from '../_lib/instagram';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const code = getQueryValue(req.query?.code);
  const state = getQueryValue(req.query?.state);
  const error = getQueryValue(req.query?.error);
  const errorDescription = getQueryValue(req.query?.error_description);

  if (error) {
    return res.redirect(302, `/?instagram=error&reason=${encodeURIComponent(errorDescription || error)}`);
  }

  const cookieNonce = parseCookies(req.headers?.cookie).ig_oauth_state;
  if (!verifyOauthState(state, cookieNonce)) {
    return sendJson(res, 400, { error: 'Invalid Instagram OAuth state. Please reconnect Instagram.' });
  }

  if (!code) return sendJson(res, 400, { error: 'Instagram did not return an authorization code.' });

  try {
    const shortLived = await exchangeAuthorizationCode(code);
    const longLived = await exchangeLongLivedToken(shortLived.access_token);
    const profile = await getProfile(longLived.access_token);
    const maxAge = Math.max(60, Math.min(longLived.expires_in || 60 * 24 * 60 * 60, 60 * 24 * 60 * 60));

    appendSetCookie(res, secureCookie('ig_access_token', longLived.access_token, maxAge));
    appendSetCookie(res, secureCookie('ig_user_id', String(profile.id || shortLived.user_id), maxAge));
    appendSetCookie(res, clearCookie('ig_oauth_state'));

    const destination = process.env.INSTAGRAM_POST_LOGIN_REDIRECT || '/?instagram=connected';
    res.redirect(302, destination);
  } catch (exchangeError) {
    const message = exchangeError instanceof Error ? exchangeError.message : 'Instagram login failed';
    res.redirect(302, `/?instagram=error&reason=${encodeURIComponent(message)}`);
  }
}
