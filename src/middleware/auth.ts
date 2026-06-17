import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '@config/env';

export type UserRole = 'citizen' | 'agent' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

function isUserRole(role: unknown): role is UserRole {
  return role === 'citizen' || role === 'agent' || role === 'admin';
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Header Authorization: Bearer <token> requis',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  try {
    const token = authorization.slice('Bearer '.length);
    const decoded = jwt.verify(token, env.JWT_SECRET) as Partial<JwtPayload>;

    if (!decoded.sub || !decoded.email || !isUserRole(decoded.role)) {
      throw new Error('Invalid JWT payload');
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token invalide ou expire',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentification requise',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Role insuffisant pour cette action',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    next();
  };
}
