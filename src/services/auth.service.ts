import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

import { env } from '@config/env';
import { LoginInput, RegisterInput } from '@/schemas/auth.schemas';

const prisma = new PrismaClient();

type AuthRole = 'citizen' | 'agent' | 'admin';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const responseRoleMap: Record<AuthRole, string> = {
  citizen: 'CITIZEN',
  agent: 'AGENT',
  admin: 'ADMIN',
};

function normalizeRole(role: unknown): AuthRole | null {
  if (typeof role !== 'string') return null;
  const normalized = role.toLowerCase();
  if (normalized === 'citizen' || normalized === 'agent' || normalized === 'admin') {
    return normalized;
  }
  return null;
}

function formatResponseUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: responseRoleMap[normalizeRole(user.role) ?? 'citizen'],
    phone: user.phone,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createToken(user: UserRecord): string {
  const role = normalizeRole(user.role) ?? 'citizen';
  const signOptions: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role,
    },
    env.JWT_SECRET as jwt.Secret,
    signOptions,
  );
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existing) {
    const error = new Error('EMAIL_ALREADY_EXISTS');
    throw error;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      password: passwordHash,
      phone: input.phone ?? null,
      role: 'citizen',
      status: 'ACTIVE',
    },
  });

  return {
    token: createToken(user),
    user: formatResponseUser(user),
  };
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isValid = await bcrypt.compare(input.password, user.password);
  if (!isValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return {
    token: createToken(user),
    user: formatResponseUser(user),
  };
}

export async function refreshToken(token: string) {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as jwt.Secret) as { sub?: string; email?: string; role?: unknown };
    if (!decoded || typeof decoded !== 'object' || !decoded.sub || !decoded.email) {
      throw new Error('INVALID_TOKEN');
    }

    const role = normalizeRole(decoded.role);
    if (!role) {
      throw new Error('INVALID_TOKEN');
    }

    const signOptions: jwt.SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    };

    return jwt.sign(
      {
        sub: decoded.sub,
        email: decoded.email,
        role,
      },
      env.JWT_SECRET as jwt.Secret,
      signOptions,
    );
  } catch {
    throw new Error('INVALID_TOKEN');
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  return formatResponseUser(user);
}

export async function getUserStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Get tour count (if user is an agent)
  let tourCount = 0;
  if (user.role === 'agent') {
    tourCount = await prisma.tour.count({
      where: { agentId: userId },
    });
  }

  // Note: Report model doesn't have userId field in current schema
  // This would need to be added to properly track user reports
  return {
    reports: 0,
    tours: tourCount,
    joinDate: user.createdAt,
  };
}
