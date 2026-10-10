import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { UserRole } from '@radius-web/shared';

export interface AuthUserData {
  id: string;
  username: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUserData;
    user: AuthUserData;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check HttpOnly cookie first, then Authorization header
      const token = request.cookies.token || request.headers.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return reply.status(401).send({ error: 'Não autenticado: token de sessão ausente.' });
      }

      const decoded = fastify.jwt.verify<AuthUserData>(token);
      request.user = decoded;
    } catch (err) {
      return reply.status(401).send({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
  });

  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    if (request.user?.role !== UserRole.ADMIN) {
      return reply.status(403).send({ error: 'Acesso negado: requer privilégios de administrador.' });
    }
  });
}

export default fp(authPlugin);
