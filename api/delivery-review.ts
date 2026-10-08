type VercelRequest = any;
type VercelResponse = any;
function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader('content-type','application/json; charset=utf-8').setHeader('cache-control','no-store').end(JSON.stringify(body));
}
function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) throw new Error('Protected delivery server configuration is missing.');
  return { url: url.replace(/\/$/, ''), key };
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const token = String(body.token || '').trim();
    const rating = Number(body.rating);
    const review = String(body.review || '').trim();
    if (token.length < 12 || token.length > 128 || !Number.isInteger(rating) || rating < 1 || rating > 5 || review.length < 12 || review.length > 2000) return json(res, 400, { error: 'Enter a review of 12 to 2,000 characters and a rating from 1 to 5.' });
    const { url, key } = config();
    const portalResponse = await fetch(`${url}/rest/v1/delivery_portals?select=id,client_name,event_name,is_published,storage_retention_until&secure_token=eq.${encodeURIComponent(token)}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const portals = await portalResponse.json().catch(() => []);
    const portal = Array.isArray(portals) ? portals[0] : null;
    if (!portal || !portal.is_published || (portal.storage_retention_until && Date.now() > new Date(portal.storage_retention_until).getTime())) return json(res, 404, { error: 'This delivery is unavailable for a review.' });
    const inserted = await fetch(`${url}/rest/v1/client_reviews`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ client_name: portal.client_name, event_name: portal.event_name, review_text: review, rating, review_type: 'Final Delivery', status: 'pending' }),
    });
    if (!inserted.ok) return json(res, 502, { error: 'The review could not be submitted. Try again later.' });
    return json(res, 200, { status: 'pending' });
  } catch (error: any) {
    return json(res, 503, { error: error?.message || 'Review could not be submitted.' });
  }
}
