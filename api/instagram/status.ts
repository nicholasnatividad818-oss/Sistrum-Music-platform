import { getProfile, requireToken, sendJson } from '../_lib/instagram';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const token = requireToken(req, res);
  if (!token) return;

  try {
    const profile = await getProfile(token);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, { connected: true, profile });
  } catch (error) {
    sendJson(res, 401, {
      connected: false,
      error: error instanceof Error ? error.message : 'Instagram session is no longer valid.'
    });
  }
}
