import type { Application, Request, Response, NextFunction, RequestHandler } from 'express';
import csurf from 'csurf';

export type LogoutOptions = {
  cookieName: string;
  authority: string;
  postLogoutRedirectUri: string;
};

export function mountLogoutRoutes(app: Application, opts: LogoutOptions) {
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
    } catch {
      finalize();
    }
  };

  app.get('/auth/logout', handler);
  app.post('/auth/logout', handler);
  app.get('/logout', handler);
  app.post('/logout', handler);
}

export function createCsrfSkipper(shouldSkip: (req: Request) => boolean): RequestHandler {
  const csrfMw = csurf();
  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldSkip(req)) return next();
    return (csrfMw as unknown as RequestHandler)(req, res, next);
  };
}
