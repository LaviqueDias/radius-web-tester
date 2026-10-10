import { z } from 'zod';

// Roles
export const UserRole = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Environments
export const EnvironmentType = {
  LAB: 'lab',
  PRODUCTION: 'production',
} as const;
export type EnvironmentType = (typeof EnvironmentType)[keyof typeof EnvironmentType];

// Packet Types
export const PacketType = {
  ACCESS_REQUEST: 'access-request',
  ACCOUNTING_START: 'accounting-start',
  ACCOUNTING_STOP: 'accounting-stop',
  ACCOUNTING_INTERIM_UPDATE: 'accounting-interim-update',
  COA_REQUEST: 'coa-request',
  DISCONNECT_REQUEST: 'disconnect-request',
} as const;
export type PacketType = (typeof PacketType)[keyof typeof PacketType];

// radclient Modes
export const RadclientMode = {
  AUTH: 'auth',
  ACCT: 'acct',
  STATUS: 'status',
  COA: 'coa',
  DISCONNECT: 'disconnect',
} as const;
export type RadclientMode = (typeof RadclientMode)[keyof typeof RadclientMode];

// Execution status
export const ExecutionStatus = {
  RESPONSE_RECEIVED: 'response_received',
  REJECTED: 'rejected',
  TIMEOUT: 'timeout',
  EXECUTION_ERROR: 'execution_error',
  INVALID_RESPONSE: 'invalid_response',
  CANCELLED: 'cancelled',
} as const;
export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

// Map packet type to radclient mode and port type
export interface PacketTypeMetadata {
  type: PacketType;
  label: string;
  defaultMode: RadclientMode;
  portField: 'authPort' | 'accountingPort' | 'coaPort';
  isDisruptive?: boolean;
  description: string;
}

export const PACKET_TYPES_METADATA: Record<PacketType, PacketTypeMetadata> = {
  [PacketType.ACCESS_REQUEST]: {
    type: PacketType.ACCESS_REQUEST,
    label: 'Access-Request',
    defaultMode: RadclientMode.AUTH,
    portField: 'authPort',
    isDisruptive: false,
    description: 'Autenticação de usuário/dispositivo no servidor RADIUS (porta padrão UDP 1812).',
  },
  [PacketType.ACCOUNTING_START]: {
    type: PacketType.ACCOUNTING_START,
    label: 'Accounting-Start',
    defaultMode: RadclientMode.ACCT,
    portField: 'accountingPort',
    isDisruptive: false,
    description: 'Notificação de início de sessão do assinante/conexão (porta padrão UDP 1813).',
  },
  [PacketType.ACCOUNTING_STOP]: {
    type: PacketType.ACCOUNTING_STOP,
    label: 'Accounting-Stop',
    defaultMode: RadclientMode.ACCT,
    portField: 'accountingPort',
    isDisruptive: false,
    description: 'Notificação de término de sessão com estatísticas de consumo (porta padrão UDP 1813).',
  },
  [PacketType.ACCOUNTING_INTERIM_UPDATE]: {
    type: PacketType.ACCOUNTING_INTERIM_UPDATE,
    label: 'Accounting-Interim-Update',
    defaultMode: RadclientMode.ACCT,
    portField: 'accountingPort',
    isDisruptive: false,
    description: 'Atualização periódica de tráfego e duração da sessão ativa (porta padrão UDP 1813).',
  },
  [PacketType.COA_REQUEST]: {
    type: PacketType.COA_REQUEST,
    label: 'CoA-Request (Change of Authorization)',
    defaultMode: RadclientMode.COA,
    portField: 'coaPort',
    isDisruptive: true,
    description: 'Altera parâmetros ou perfil de uma sessão ativa em andamento (porta padrão UDP 3799).',
  },
  [PacketType.DISCONNECT_REQUEST]: {
    type: PacketType.DISCONNECT_REQUEST,
    label: 'Disconnect-Request (PoD)',
    defaultMode: RadclientMode.DISCONNECT,
    portField: 'coaPort',
    isDisruptive: true,
    description: 'Encerra compulsoriamente a conexão do assinante no NAS/BRAS (porta padrão UDP 3799).',
  },
};

// Attribute Item definition
export interface RadiusAttribute {
  name: string;
  value: string;
  operator?: string; // defaults to '='
  isSensitive?: boolean;
}

// Default/suggested attributes per packet type
export const SUGGESTED_ATTRIBUTES: Record<PacketType, RadiusAttribute[]> = {
  [PacketType.ACCESS_REQUEST]: [
    { name: 'User-Name', value: 'teste@provedor.com.br' },
    { name: 'User-Password', value: 'senha123', isSensitive: true },
    { name: 'NAS-IP-Address', value: '192.168.1.1' },
    { name: 'NAS-Port', value: '0' },
    { name: 'NAS-Port-Type', value: 'Ethernet' },
    { name: 'Service-Type', value: 'Framed-User' },
    { name: 'Framed-Protocol', value: 'PPP' },
  ],
  [PacketType.ACCOUNTING_START]: [
    { name: 'User-Name', value: 'cliente-01' },
    { name: 'Acct-Status-Type', value: 'Start' },
    { name: 'Acct-Session-Id', value: 'sessao-2026-0001' },
    { name: 'NAS-IP-Address', value: '192.168.1.1' },
    { name: 'NAS-Port', value: '10' },
    { name: 'NAS-Port-Type', value: 'Virtual' },
    { name: 'Framed-IP-Address', value: '10.100.1.50' },
    { name: 'Calling-Station-Id', value: 'AA:BB:CC:DD:EE:01' },
    { name: 'Called-Station-Id', value: 'BRAS-CENTRAL' },
  ],
  [PacketType.ACCOUNTING_STOP]: [
    { name: 'User-Name', value: 'cliente-01' },
    { name: 'Acct-Status-Type', value: 'Stop' },
    { name: 'Acct-Session-Id', value: 'sessao-2026-0001' },
    { name: 'NAS-IP-Address', value: '192.168.1.1' },
    { name: 'NAS-Port', value: '10' },
    { name: 'NAS-Port-Type', value: 'Virtual' },
    { name: 'Framed-IP-Address', value: '10.100.1.50' },
    { name: 'Calling-Station-Id', value: 'AA:BB:CC:DD:EE:01' },
    { name: 'Called-Station-Id', value: 'BRAS-CENTRAL' },
    { name: 'Acct-Session-Time', value: '3600' },
    { name: 'Acct-Input-Octets', value: '10485760' },
    { name: 'Acct-Output-Octets', value: '52428800' },
    { name: 'Acct-Input-Packets', value: '15000' },
    { name: 'Acct-Output-Packets', value: '38000' },
    { name: 'Acct-Terminate-Cause', value: 'User-Request' },
  ],
  [PacketType.ACCOUNTING_INTERIM_UPDATE]: [
    { name: 'User-Name', value: 'cliente-01' },
    { name: 'Acct-Status-Type', value: 'Interim-Update' },
    { name: 'Acct-Session-Id', value: 'sessao-2026-0001' },
    { name: 'NAS-IP-Address', value: '192.168.1.1' },
    { name: 'NAS-Port', value: '10' },
    { name: 'NAS-Port-Type', value: 'Virtual' },
    { name: 'Framed-IP-Address', value: '10.100.1.50' },
    { name: 'Calling-Station-Id', value: 'AA:BB:CC:DD:EE:01' },
    { name: 'Called-Station-Id', value: 'BRAS-CENTRAL' },
    { name: 'Acct-Session-Time', value: '1800' },
    { name: 'Acct-Input-Octets', value: '5242880' },
    { name: 'Acct-Output-Octets', value: '26214400' },
  ],
  [PacketType.COA_REQUEST]: [
    { name: 'User-Name', value: 'cliente-01' },
    { name: 'Acct-Session-Id', value: 'sessao-2026-0001' },
    { name: 'NAS-IP-Address', value: '192.168.1.1' },
    { name: 'Framed-IP-Address', value: '10.100.1.50' },
  ],
  [PacketType.DISCONNECT_REQUEST]: [
    { name: 'User-Name', value: 'cliente-01' },
    { name: 'Acct-Session-Id', value: 'sessao-2026-0001' },
    { name: 'NAS-IP-Address', value: '192.168.1.1' },
  ],
};

// Common attribute names helper
export const POPULAR_RADIUS_ATTRIBUTES = [
  'User-Name',
  'User-Password',
  'CHAP-Password',
  'NAS-IP-Address',
  'NAS-Port',
  'NAS-Port-Type',
  'Service-Type',
  'Framed-Protocol',
  'Framed-IP-Address',
  'Framed-IP-Netmask',
  'Framed-Routing',
  'Filter-Id',
  'Framed-MTU',
  'Framed-Compression',
  'Login-IP-Host',
  'Reply-Message',
  'Callback-Number',
  'Callback-Id',
  'Framed-Route',
  'Framed-IPX-Network',
  'State',
  'Class',
  'Vendor-Specific',
  'Session-Timeout',
  'Idle-Timeout',
  'Termination-Action',
  'Called-Station-Id',
  'Calling-Station-Id',
  'NAS-Identifier',
  'Proxy-State',
  'Login-LAT-Service',
  'Login-LAT-Node',
  'Login-LAT-Group',
  'Framed-AppleTalk-Link',
  'Framed-AppleTalk-Network',
  'Framed-AppleTalk-Zone',
  'Acct-Status-Type',
  'Acct-Delay-Time',
  'Acct-Input-Octets',
  'Acct-Output-Octets',
  'Acct-Session-Id',
  'Acct-Authentic',
  'Acct-Session-Time',
  'Acct-Input-Packets',
  'Acct-Output-Packets',
  'Acct-Terminate-Cause',
  'Acct-Multi-Session-Id',
  'Acct-Link-Count',
  'Acct-Input-Gigawords',
  'Acct-Output-Gigawords',
  'Event-Timestamp',
  'NAS-Port-Id',
  'Connect-Info',
];

// -------------------------------------------------------------
// Zod Schemas for Validation
// -------------------------------------------------------------

// Sanitizes and checks attribute names & values against CRLF injection
export const radiusAttributeNameRegex = /^[A-Za-z0-9_\-\.]+$/;

export const radiusAttributeSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome do atributo é obrigatório')
    .max(128, 'Nome de atributo muito longo')
    .regex(
      radiusAttributeNameRegex,
      'Nome do atributo contém caracteres inválidos. Apenas letras, números, hífen, sublinhado e ponto são permitidos'
    ),
  value: z
    .string()
    .min(1, 'Valor do atributo é obrigatório')
    .max(1024, 'Valor do atributo excede 1024 caracteres')
    .refine((val) => !/[\r\n\0]/.test(val), {
      message: 'Valor não pode conter quebras de linha ou caracteres de controle',
    }),
  operator: z.string().optional().default('='),
  isSensitive: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Usuário é obrigatório').max(64),
  password: z.string().min(1, 'Senha é obrigatória').max(128),
});

// Host validation (IPv4, IPv6 or valid FQDN / hostname)
const hostRegex = /^(?:(?:[0-9]{1,3}\.){3}[0-9]{1,3}|(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+|\[?[0-9a-fA-F:]+\]?)$/;

export const serverCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100),
  host: z
    .string()
    .min(1, 'Host é obrigatório')
    .max(255)
    .regex(hostRegex, 'Host deve ser um endereço IP ou hostname válido'),
  authPort: z.number().int().min(1).max(65535).default(1812),
  accountingPort: z.number().int().min(1).max(65535).default(1813),
  coaPort: z.number().int().min(1).max(65535).optional().default(3799),
  sharedSecret: z
    .string()
    .min(1, 'Shared secret é obrigatório')
    .max(256)
    .refine((val) => !/[\r\n\0]/.test(val), 'Shared secret não pode conter quebras de linha'),
  environment: z.enum(['lab', 'production']).default('lab'),
  isEnabled: z.boolean().default(true),
});

export const serverUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  host: z.string().min(1).max(255).regex(hostRegex).optional(),
  authPort: z.number().int().min(1).max(65535).optional(),
  accountingPort: z.number().int().min(1).max(65535).optional(),
  coaPort: z.number().int().min(1).max(65535).optional(),
  sharedSecret: z
    .string()
    .min(1)
    .max(256)
    .refine((val) => !/[\r\n\0]/.test(val), 'Shared secret não pode conter quebras de linha')
    .optional(),
  environment: z.enum(['lab', 'production']).optional(),
  isEnabled: z.boolean().optional(),
});

export const packetOptionsSchema = z.object({
  timeoutSeconds: z.number().int().min(1).max(30).default(3),
  retries: z.number().int().min(0).max(5).default(2),
});

export const packetPreviewSchema = z.object({
  packetType: z.enum([
    PacketType.ACCESS_REQUEST,
    PacketType.ACCOUNTING_START,
    PacketType.ACCOUNTING_STOP,
    PacketType.ACCOUNTING_INTERIM_UPDATE,
    PacketType.COA_REQUEST,
    PacketType.DISCONNECT_REQUEST,
  ]),
  attributes: z.array(radiusAttributeSchema).min(1, 'Informe pelo menos um atributo'),
});

export const packetSendSchema = z.object({
  serverId: z.string().uuid('ID de servidor inválido'),
  packetType: z.enum([
    PacketType.ACCESS_REQUEST,
    PacketType.ACCOUNTING_START,
    PacketType.ACCOUNTING_STOP,
    PacketType.ACCOUNTING_INTERIM_UPDATE,
    PacketType.COA_REQUEST,
    PacketType.DISCONNECT_REQUEST,
  ]),
  attributes: z.array(radiusAttributeSchema).min(1, 'Informe pelo menos um atributo'),
  options: packetOptionsSchema.default({ timeoutSeconds: 3, retries: 2 }),
  disruptiveConfirmed: z.boolean().optional().default(false),
});

export const templateCreateSchema = z.object({
  name: z.string().min(2, 'Nome do template deve ter no mínimo 2 caracteres').max(100),
  description: z.string().max(255).optional(),
  packetType: z.enum([
    PacketType.ACCESS_REQUEST,
    PacketType.ACCOUNTING_START,
    PacketType.ACCOUNTING_STOP,
    PacketType.ACCOUNTING_INTERIM_UPDATE,
    PacketType.COA_REQUEST,
    PacketType.DISCONNECT_REQUEST,
  ]),
  attributes: z.array(radiusAttributeSchema).min(1, 'Informe pelo menos um atributo'),
});

export const templateUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(255).optional(),
  packetType: z
    .enum([
      PacketType.ACCESS_REQUEST,
      PacketType.ACCOUNTING_START,
      PacketType.ACCOUNTING_STOP,
      PacketType.ACCOUNTING_INTERIM_UPDATE,
      PacketType.COA_REQUEST,
      PacketType.DISCONNECT_REQUEST,
    ])
    .optional(),
  attributes: z.array(radiusAttributeSchema).min(1).optional(),
});

// Helper to check Acct-Status-Type consistency
export function validateAcctStatusConsistency(
  packetType: PacketType,
  attributes: RadiusAttribute[]
): { valid: boolean; message?: string } {
  const acctStatusAttr = attributes.find((a) => a.name.toLowerCase() === 'acct-status-type');

  if (packetType === PacketType.ACCOUNTING_START) {
    if (!acctStatusAttr) {
      return { valid: false, message: 'Accounting-Start exige o atributo Acct-Status-Type = Start' };
    }
    if (acctStatusAttr.value.toLowerCase() !== 'start' && acctStatusAttr.value !== '1') {
      return {
        valid: false,
        message: `Para Accounting-Start, Acct-Status-Type deve ser 'Start' (atual: '${acctStatusAttr.value}')`,
      };
    }
  } else if (packetType === PacketType.ACCOUNTING_STOP) {
    if (!acctStatusAttr) {
      return { valid: false, message: 'Accounting-Stop exige o atributo Acct-Status-Type = Stop' };
    }
    if (acctStatusAttr.value.toLowerCase() !== 'stop' && acctStatusAttr.value !== '2') {
      return {
        valid: false,
        message: `Para Accounting-Stop, Acct-Status-Type deve ser 'Stop' (atual: '${acctStatusAttr.value}')`,
      };
    }
  } else if (packetType === PacketType.ACCOUNTING_INTERIM_UPDATE) {
    if (!acctStatusAttr) {
      return {
        valid: false,
        message: 'Accounting-Interim-Update exige o atributo Acct-Status-Type = Interim-Update',
      };
    }
    if (
      acctStatusAttr.value.toLowerCase() !== 'interim-update' &&
      acctStatusAttr.value.toLowerCase() !== 'interim' &&
      acctStatusAttr.value !== '3'
    ) {
      return {
        valid: false,
        message: `Para Accounting-Interim-Update, Acct-Status-Type deve ser 'Interim-Update' (atual: '${acctStatusAttr.value}')`,
      };
    }
  }

  return { valid: true };
}

// Format attributes for radclient stdin
export function formatAttributesForRadclient(
  attributes: RadiusAttribute[],
  options?: { redactSensitive?: boolean }
): string {
  return (
    attributes
      .map((attr) => {
        let val = attr.value;
        const isSecretField =
          attr.isSensitive ||
          /password|secret|key/i.test(attr.name);

        if (options?.redactSensitive && isSecretField) {
          val = '***REDACTED***';
        } else if (val.includes(' ') || val.includes('\t')) {
          // Quote strings with spaces if not already quoted
          if (!val.startsWith('"') || !val.endsWith('"')) {
            val = `"${val.replace(/"/g, '\\"')}"`;
          }
        }
        const op = attr.operator || '=';
        return `${attr.name} ${op} ${val}`;
      })
      .join('\n') + '\n'
  );
}
