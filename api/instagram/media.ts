import { getQueryValue, graphGet, requireToken, sendJson } from '../_lib/instagram';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const token = requireToken(req, res);
  if (!token) return;

  try {
    const limit = getQueryValue(req.query?.limit) || '25';
    const media = await graphGet('/me/media', token, {
      fields: 'id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,username',
      limit
    });
    sendJson(res, 200, media);
  } catch (error) {
    sendJson(res, 502, { error: error instanceof Error ? error.message : 'Unable to load Instagram media' });
  }
}
