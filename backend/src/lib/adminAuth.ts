import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? '';

export function verifyAdminCredentials(email: string, password: string): boolean {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH || !JWT_SECRET) return false;
  if (email.trim().toLowerCase() !== ADMIN_EMAIL.trim().toLowerCase()) return false;
  return bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
}

export function issueAdminToken(email: string): string {
  return jwt.sign({ sub: email, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing admin token.' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role?: string };
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized.' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token.' });
  }
}
