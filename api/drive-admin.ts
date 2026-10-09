import list from './_lib/driveRoutes/drive-list.js';
import start from './_lib/driveRoutes/drive-oauth-start.js';
import callback from './_lib/driveRoutes/drive-oauth-callback.js';
import status from './_lib/driveRoutes/drive-status.js';

// Packaging only: legacy URLs rewrite here; each handler retains its auth/config.
const routes: Record<string, (req: any, res: any) => Promise<any>> = {
  'drive-list': list, 'drive-oauth-start': start,
  'drive-oauth-callback': callback, 'drive-status': status,
};
export default async function handler(req: any, res: any) {
  const route = req.query?.route;
  const delegated = typeof route === 'string' ? routes[route] : undefined;
  if (!delegated || !Object.hasOwn(routes, route)) return res.status(404).setHeader('cache-control', 'no-store').end('Unknown Drive route.');
  return delegated(req, res);
}
