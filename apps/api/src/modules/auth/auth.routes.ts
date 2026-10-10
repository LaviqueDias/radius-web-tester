import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@radius-web/shared';
import { prisma } from '../../lib/prisma';
import { logAuditEvent } from '../audit/audit.service';

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos.',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { username, password } = parseResult.data;

    // Generic error to avoid account enumeration
    const genericErrorMsg = 'Usuário ou senha inválidos.';

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      // Run dummy compare to mitigate timing attacks
      await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUU0123456789');
      return reply.status(401).send({ error: genericErrorMsg });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await logAuditEvent({
        userId: user.id,
        action: 'login_failed',
        resource: 'auth',
        details: { username, reason: 'invalid_password' },
        ipAddress: request.ip,
      });
      return reply.status(401).send({ error: genericErrorMsg });
    }

    if (!user.isActive) {
      return reply.status(403).send({ error: 'Conta de usuário desativada. Contate o administrador.' });
    }

    const token = fastify.jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      { expiresIn: '7d' }
    );

    // Set HttpOnly cookie
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    await logAuditEvent({
      userId: user.id,
      action: 'login_success',
      resource: 'auth',
      ipAddress: request.ip,
    });

    return reply.send({
      message: 'Login realizado com sucesso.',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.send({ message: 'Sessão encerrada com sucesso.' });
  });

  // Get current user profile
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      reply.clearCookie('token', { path: '/' });
      return reply.status(401).send({ error: 'Sessão expirada ou usuário inativo.' });
    }

    return reply.send({ user });
  });
}
