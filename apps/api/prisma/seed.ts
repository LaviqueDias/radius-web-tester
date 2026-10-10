import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { encryptSecret } from '../src/lib/crypto';
import { PacketType, SUGGESTED_ATTRIBUTES } from '@radius-web/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados RADIUS Web Tester...');

  // 1. Create or update admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPasswordHash, role: Role.admin, isActive: true },
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: Role.admin,
      isActive: true,
    },
  });
  console.log('✅ Usuário administrador criado/atualizado: admin / admin123');

  // 2. Create or update operator user
  const operatorPasswordHash = await bcrypt.hash('operator123', 10);
  const operator = await prisma.user.upsert({
    where: { username: 'operator' },
    update: { passwordHash: operatorPasswordHash, role: Role.operator, isActive: true },
    create: {
      username: 'operator',
      passwordHash: operatorPasswordHash,
      role: Role.operator,
      isActive: true,
    },
  });
  console.log('✅ Usuário operador criado/atualizado: operator / operator123');

  // 3. Create default lab RADIUS server
  const encryptedSecret = encryptSecret('testing123');
  const existingServer = await prisma.radiusServer.findFirst({
    where: { name: 'FreeRADIUS Lab Local' },
  });

  let labServer = existingServer;
  if (!existingServer) {
    labServer = await prisma.radiusServer.create({
      data: {
        name: 'FreeRADIUS Lab Local',
        host: '127.0.0.1',
        authPort: 1812,
        accountingPort: 1813,
        coaPort: 3799,
        secretReference: encryptedSecret,
        environment: 'lab',
        isEnabled: true,
      },
    });
    console.log('✅ Servidor RADIUS de laboratório criado: FreeRADIUS Lab Local (127.0.0.1)');
  }

  const existingDockerServer = await prisma.radiusServer.findFirst({
    where: { name: 'FreeRADIUS Lab (Docker)' },
  });
  if (!existingDockerServer) {
    await prisma.radiusServer.create({
      data: {
        name: 'FreeRADIUS Lab (Docker)',
        host: 'freeradius',
        authPort: 1812,
        accountingPort: 1813,
        coaPort: 3799,
        secretReference: encryptedSecret,
        environment: 'lab',
        isEnabled: true,
      },
    });
    console.log('✅ Servidor RADIUS de laboratório criado: FreeRADIUS Lab (Docker) (freeradius)');
  }

  // 4. Create default templates
  const templates = [
    {
      name: 'Accounting Start Padrão',
      description: 'Modelo de início de sessão PPPoE/IPoE com atributos recomendados',
      packetType: PacketType.ACCOUNTING_START,
      attributes: SUGGESTED_ATTRIBUTES[PacketType.ACCOUNTING_START],
    },
    {
      name: 'Accounting Stop com Consumo',
      description: 'Modelo de término de sessão com octetos e contadores de tempo',
      packetType: PacketType.ACCOUNTING_STOP,
      attributes: SUGGESTED_ATTRIBUTES[PacketType.ACCOUNTING_STOP],
    },
    {
      name: 'Access-Request Teste',
      description: 'Autenticação de usuário para validação de credencial',
      packetType: PacketType.ACCESS_REQUEST,
      attributes: SUGGESTED_ATTRIBUTES[PacketType.ACCESS_REQUEST],
    },
    {
      name: 'Accounting Interim-Update Periódico',
      description: 'Atualização periódica de tráfego de assinante ativo',
      packetType: PacketType.ACCOUNTING_INTERIM_UPDATE,
      attributes: SUGGESTED_ATTRIBUTES[PacketType.ACCOUNTING_INTERIM_UPDATE],
    },
  ];

  for (const t of templates) {
    const existing = await prisma.packetTemplate.findFirst({
      where: { name: t.name },
    });
    if (!existing) {
      await prisma.packetTemplate.create({
        data: {
          name: t.name,
          description: t.description,
          packetType: t.packetType,
          attributesJson: t.attributes as any,
          createdById: admin.id,
        },
      });
    }
  }
  console.log('✅ Templates padrão de pacotes criados.');

  console.log('🚀 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
