import { Router } from 'express';
import { Issuer, generators } from 'openid-client';

// Environment variables
const {
  AZURE_TENANT_ID = '',
  USER_OIDC_CLIENT_ID = '',
  USER_OIDC_CLIENT_SECRET = '', // for confidential flow if needed later
  USER_OIDC_REDIRECT = '',
  OIDC_AUTHORITY = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
} = process.env;

if (!AZURE_TENANT_ID) {
  // eslint-disable-next-line no-console
  console.warn('[oidc:user] AZURE_TENANT_ID not set – OIDC will fail');
}

const router = Router();

async function init() {
  if (!OIDC_AUTHORITY || !USER_OIDC_CLIENT_ID || !USER_OIDC_REDIRECT) {
    throw new Error('[oidc:user] Missing required OIDC env vars. Set AZURE_TENANT_ID, USER_OIDC_CLIENT_ID, USER_OIDC_REDIRECT');
  }
  const issuer = await Issuer.discover(OIDC_AUTHORITY);
  const client = new issuer.Client({
    client_id: USER_OIDC_CLIENT_ID,
    client_secret: USER_OIDC_CLIENT_SECRET,
    token_endpoint_auth_method: 'client_secret_post',
    redirect_uris: [USER_OIDC_REDIRECT],
    response_types: ['code'],
  });

  // Initiate login
  router.get('/auth/health', (_req, res) => res.json({ ok: true }));

  router.get('/auth/oidc/start', (req, res) => {
    // Ignore Chrome prefetch/prerender that would break state
    const purpose = req.headers['purpose'] || req.headers['sec-purpose'];
    if (typeof purpose === 'string' && purpose.includes('prefetch')) {
      req.log?.info?.('prefetch detected – skipping OIDC start');
      return res.status(204).end();
    }
    req.session.regenerate(err => {
      if (err) {
        req.log?.error?.(err, 'session.regenerate failed');
        return res.status(500).send('Session error');
      }
      const state = generators.state();
      const nonce = undefined; // not used for local dev
      (req.session as any).oidc = { state };
      const url = client.authorizationUrl({ scope: 'openid profile email', state, prompt: 'login' });
      req.session.save(() => {
        req.log?.info?.('Redirecting to OIDC auth URL');
        res.redirect(url);
      });
    });
  });

  // Callback
  router.get('/auth/oidc/callback', async (req: any, res, next) => {
    console.log('[user-ui] OIDC callback hit', { query: req.query });
    try {
      const { state } = req.query;
      const sess = (req.session as any).oidc || {};
      if (state !== sess.state) {
        console.error('[user-ui] State mismatch', { state, expected: sess.state });
        return res.status(400).send('Invalid state');
      }
      const params = client.callbackParams(req);
      const tokenSet = await client.callback(USER_OIDC_REDIRECT, params, { state: sess.state });
      console.log('[user-ui] Token set received', tokenSet);
      const claims: any = tokenSet.claims();
      // Minimal session user object
      req.session.user = {
        id: claims.sub,
        email: claims.preferred_username || claims.email || '',
        entraId: claims.oid || '',
        roles: ['user'],
      };
      console.log('[user-ui] Session user set, redirecting to /keys');
      res.redirect('/keys');
    } catch (e) {
      console.error('[user-ui] Callback error', {
        message: (e as any).message,
        stack: (e as any).stack,
        response: (e as any).response?.body,
      });
      next(e);
    }
  });
}

init().catch((e) => console.error('[oidc:user] init error', e));

export { router };
