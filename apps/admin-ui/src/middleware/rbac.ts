import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.user;
  if (!user) return res.status(401).send("Unauthorized");
  // Enforce privileged account naming in production
  if ((process.env.NODE_ENV || "development") === "production") {
    const uname: string = (user.email || user.userPrincipalName || "") as string;
    if (!uname.startsWith("priv_")) {
      return res.status(403).send("Privileged account required");
    }
  }
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
