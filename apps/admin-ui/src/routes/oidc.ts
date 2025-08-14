import { Router } from 'express';
import { Issuer, generators } from 'openid-client';

const router = Router();

// Load env vars (must be set in production deployment)
const {
  AZURE_TENANT_ID = '',
  ADMIN_OIDC_CLIENT_ID = '',
  ADMIN_OIDC_CLIENT_SECRET = '', // may be used later for confidential flow
  ADMIN_OIDC_REDIRECT = '',
  OIDC_AUTHORITY = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
} = process.env;

const OIDC_CLIENT_ID = ADMIN_OIDC_CLIENT_ID;
const OIDC_REDIRECT_URI = ADMIN_OIDC_REDIRECT;

async function init() {
  // Always attempt to initialise OIDC. If required env vars are missing, throw early
  if (!OIDC_AUTHORITY || !OIDC_CLIENT_ID || !OIDC_REDIRECT_URI) {
    throw new Error('[oidc] Missing required OIDC env vars. Set OIDC_AUTHORITY, OIDC_CLIENT_ID, OIDC_REDIRECT_URI');
  }
  const issuer = await Issuer.discover(OIDC_AUTHORITY);
  const client = new issuer.Client({
    client_id: OIDC_CLIENT_ID,
    client_secret: ADMIN_OIDC_CLIENT_SECRET,
    token_endpoint_auth_method: 'client_secret_post',
    redirect_uris: [OIDC_REDIRECT_URI],
    response_types: ['code'],
  });

  // Health endpoint
  router.get('/auth/health', (_req, res) => res.json({ ok: true }));

  // Login start – always force interactive login so cached non-priv creds cannot be reused
  router.get('/auth/oidc/start', (req, res) => {
    req.session.regenerate(err => {
      if (err) {
        req.log?.error?.(err, 'session.regenerate failed');
        return res.status(500).send('Session error');
      }
      const state = generators.state();
      const nonce = undefined; // omit nonce in local dev
      // store in session
      (req.session as any).oidc = { state };
      const url = client.authorizationUrl({ scope: 'openid profile email', state, prompt: 'login' });
      req.session.save(()=>{
        req.log?.info?.('Redirecting to OIDC auth URL (admin)');
        res.redirect(url);
      });
    });
  });

  // Callback – exchange code, create session
  router.get('/auth/oidc/callback', async (req: any, res, next) => {
    try {
      const { state } = req.query;
      const sess = (req.session as any).oidc || {};
      if (!sess.state || state !== sess.state) return res.status(400).send('Invalid state');
      const params = client.callbackParams(req);
      const tokenSet = await client.callback(OIDC_REDIRECT_URI, params, { state: sess.state });
      const claims: any = tokenSet.claims();
      // Store minimal session user object
      req.session.user = {
        id: claims.sub,
        email: claims.preferred_username || claims.email || '',
        entraId: claims.oid || '',
        roles: ['admin'],
      };
      res.redirect('/admin/users');
    } catch (e) {
      console.error('[admin-ui] Callback error', {
        message: (e as any).message,
        stack: (e as any).stack,
        response: (e as any).response?.body,
      });
      next(e);
    }
  });
}

init().catch((e) => console.error('[oidc] init error', e));

export { router };
