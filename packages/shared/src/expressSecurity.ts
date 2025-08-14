import type { Application, Request, Response, NextFunction, RequestHandler } from 'express';
import csurf from 'csurf';

export type LogoutOptions = {
  cookieName: string;           // e.g. 'admin.sid' | 'user.sid'
  authority: string;            // e.g. https://login.microsoftonline.com/<tenant>/v2.0
  postLogoutRedirectUri: string;// where Azure should redirect after sign-out
};

// Mounts GET and POST routes for /auth/logout and /logout that:
// - destroy the session
// - clear the specified cookie
// - redirect to Azure end-session endpoint with post_logout_redirect_uri
export function mountLogoutRoutes(app: Application, opts: LogoutOptions) {
  // Normalize authority: remove trailing '/v2.0' and any trailing slash
  const normAuthority = opts.authority.replace(/\/?v2\.0\/?$/, '').replace(/\/$/, '');
  const endSessionEndpoint = `${normAuthority}/oauth2/v2.0/logout`;

  const handler: RequestHandler = (req: Request, res: Response) => {
    const finalize = () => {
      res.clearCookie(opts.cookieName, { path: '/' });
      const url = `${endSessionEndpoint}?post_logout_redirect_uri=${encodeURIComponent(opts.postLogoutRedirectUri)}`;
      return res.redirect(url);
    };
    try {
      const sess: any = (req as any).session;
      if (sess && typeof sess.destroy === 'function') {
        sess.destroy(() => finalize());
      } else {
        finalize();
      }
    } catch (_e) {
      finalize();
    }
  };

  app.get('/auth/logout', handler);
  app.post('/auth/logout', handler);
  app.get('/logout', handler);
  app.post('/logout', handler);
}

// Returns a csurf-wrapped middleware that skips protection for specified requests.
// Ensure this is mounted AFTER cookie-parser and session, and BEFORE form routes.
export function createCsrfSkipper(shouldSkip: (req: Request) => boolean): RequestHandler {
  const csrfMw = csurf();
  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldSkip(req)) return next();
    return (csrfMw as unknown as RequestHandler)(req, res, next);
  };
}
