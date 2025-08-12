import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.user;
  if (!user) return res.status(401).send("Unauthorized");
  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req.session as any)?.user;
    if (!user) return res.status(401).send("Unauthorized");
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    if (!roles.includes(role)) return res.status(403).send("Forbidden");
    next();
  };
}
