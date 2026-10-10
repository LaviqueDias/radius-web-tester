# RADIUS Web Tester

Aplicação Web interna de nível de produção para provedores de Internet (ISPs) e operadores de rede, projetada para montar, validar, enviar e analisar pacotes do protocolo **RADIUS** (RFC 2865, RFC 2866, RFC 5176) utilizando a ferramenta de linha de comando `radclient` de forma segura e controlada.

---

## 1. Arquitetura e Tecnologias

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router DOM.
- **Backend:** Node.js (v20+), Fastify, TypeScript, Zod, Prisma ORM.
- **Banco de Dados:** PostgreSQL 17 (com Docker e migrações Prisma).
- **Executor RADIUS:** `child_process.spawn()` sem shell (`shell: false`), arquivo temporário de segredo com permissão `0600` e limpeza garantida, semáforo de concorrência e parser detalhado de respostas.
- **Segurança:** Criptografia autenticada AES-256-GCM para shared secrets de servidores, tokens JWT seguros via cookies `HttpOnly`, controle de acesso baseado em funções (RBAC: `admin` e `operator`) e sanitização rigorosa contra injeção de atributos (CRLF injection).

---

## 2. Tipos de Pacotes Suportados

1. **Access-Request:** Autenticação de assinante/dispositivo (modo `auth`, UDP 1812 por padrão).
2. **Accounting-Start:** Notificação de início de conexão (modo `acct`, UDP 1813).
3. **Accounting-Stop:** Notificação de término de sessão com estatísticas de consumo (modo `acct`, UDP 1813).
4. **Accounting-Interim-Update:** Atualização periódica de contabilização (modo `acct`, UDP 1813).
5. **CoA-Request / Disconnect-Request:** Suportados com modal de confirmação explícita obrigatória e proteção contra operações acidentais em produção (porta UDP 3799).

---

## 3. Estrutura do Repositório

```text
radius-web-tester/
├── apps/
│   ├── api/                     # Backend Fastify + Prisma + TypeScript
│   │   ├── prisma/              # Schema, migrações e seed
│   │   ├── src/
│   │   │   ├── lib/             # Crypto AES-256-GCM e Prisma Client
│   │   │   ├── modules/
│   │   │   │   ├── auth/        # Login, logout, sessão e RBAC
│   │   │   │   ├── servers/     # CRUD de servidores RADIUS e proteção de segredos
│   │   │   │   ├── packets/     # Tipos, prévia de stdin e envio seguro
│   │   │   │   ├── execution/   # Executor radclient e parser de respostas
│   │   │   │   ├── templates/   # Modelos reutilizáveis de pacotes
│   │   │   │   ├── history/     # Consulta paginada de execuções
│   │   │   │   └── audit/       # Trilha de auditoria
│   │   │   ├── plugins/         # Plugins Fastify (JWT, Cookie, RBAC)
│   │   │   └── app.ts           # Inicialização e healthcheck
│   │   └── tests/               # Testes unitários e de integração (Vitest)
│   └── web/                     # Frontend React + TypeScript + Vite + Tailwind
│       └── src/
│           ├── components/      # UI components (Navbar, StatusBadge, ConfirmModal)
│           ├── context/         # AuthContext
│           └── pages/           # Login, Dashboard, Builder, Servers, History, Templates
├── packages/
│   └── shared/                  # Schemas Zod, validações, tipos e dicionário RADIUS
├── docker-compose.yml           # Compose unificado (PostgreSQL, API com radclient, Web)
├── .env.example
└── README.md
```

---

## 4. Requisitos Prévios

- **Node.js** v20+ e **npm** v10+
- **Docker** e **Docker Compose v2**
- Em ambiente de produção/host: pacote `freeradius-utils` (que fornece o binário `radclient`). *No container Docker da API, o `radclient` já é instalado nativamente via Alpine.*

---

## 5. Instalação e Execução Local (Desenvolvimento)

### 5.1 Configuração de Ambiente

Copie o arquivo de exemplo e ajuste as variáveis se necessário:

```bash
cp .env.example .env
```

O arquivo `.env` já vem pré-configurado para desenvolvimento local com as portas padrão.

### 5.2 Subir o Banco PostgreSQL

Se ainda não estiver rodando o PostgreSQL:

```bash
docker compose up -d postgres
```

### 5.3 Instalar Dependências e Inicializar o Banco

```bash
# Instalar todas as dependências dos workspaces
npm install

# Compilar o pacote compartilhado
npm run build --workspace=packages/shared

# Gerar o cliente Prisma e aplicar as migrações
npm run prisma:generate
npm run prisma:migrate

# Executar o seed (cria usuários admin, operator e templates padrão)
npm run prisma:seed
```

### 5.4 Iniciar os Serviços em Modo Dev

```bash
# Inicia a API (porta 3001) e o Frontend Vite (porta 5173) simultaneamente:
npm run dev
```

Acesse a interface no navegador: **`http://localhost:5173`**

### Credenciais Padrão Criadas pelo Seed:
- **Administrador:** `admin` / `admin123`
- **Operador:** `operator` / `operator123`

---

## 6. Execução via Docker Compose (Produção / Homologação)

Para subir todo o ambiente de forma isolada, incluindo o backend com o `radclient` instalado no container:

```bash
docker compose up -d --build
```

- **Frontend Web:** `http://localhost:5173`
- **API Backend:** `http://localhost:3001/api/health`
- **PostgreSQL:** Disponível internamente no container e em `127.0.0.1:5432` no host

---

## 7. Servidor FreeRADIUS de Teste Integrado (Container Docker)

O projeto inclui um container dedicado do **FreeRADIUS 3.2** pronto para testes de laboratório no [`docker-compose.yml`](file:///home/lavique/Documentos/Programação/radius-web-tester/docker-compose.yml):

### Iniciar o FreeRADIUS de Laboratório:
```bash
docker compose up -d freeradius
```

### Configurações do Container (`radius-web-freeradius`):
- **Shared Secret:** `testing123`
- **Portas Expostas (UDP):**
  - `1812/udp` - Autenticação (`auth`)
  - `1813/udp` - Contabilização (`acct`)
  - `3799/udp` - CoA & Disconnect (`coa`)
- **Usuários Pré-configurados:**
  - `cliente-teste` / senha `senha123` -> Retorna **Access-Accept** com IP atribuído (`192.168.100.50`)
  - `admin-rede` / senha `admin123` -> Retorna **Access-Accept** com perfil administrativo
  - `usuario-bloqueado` / qualquer senha -> Retorna **Access-Reject** para testes de falha
  - `teste` / senha `teste` -> Retorna **Access-Accept** rápido
- **Acompanhar Logs de Pacotes em Tempo Real:**
  ```bash
  docker logs -f radius-web-freeradius
  ```
- **Alvo no RADIUS Web Tester:**
  - Se a API estiver rodando no Docker: selecione o servidor **FreeRADIUS Lab (Docker)** (`host: freeradius`).
  - Se a API estiver rodando localmente no host (`npm run dev`): selecione o servidor **FreeRADIUS Lab Local** (`host: 127.0.0.1`).

---

## 8. Testes Automatizados

O projeto conta com suíte completa de testes unitários e de integração com Vitest:

- Testes do parser de saídas do `radclient` (Accept, Reject, Accounting, Timeout, Authenticator Inválido).
- Testes de criptografia AES-256-GCM dos segredos.
- Testes de consistência de atributos e proteção contra injeção CRLF.
- Testes de integração de endpoints Fastify (Autenticação, RBAC, Autorização de Servidores e Prévia).

Para executar os testes:

```bash
npm run test
```

---

## 9. Backup e Restauração do Banco de Dados

### Backup:
```bash
docker exec -t radius-web-postgres pg_dump -U postgres dbradius-web-tester > backup_radius_web_$(date +%F).sql
```

### Restauração:
```bash
cat backup_radius_web.sql | docker exec -i radius-web-postgres psql -U postgres -d dbradius-web-tester
```

---

## 10. Segurança e Boas Práticas Implementadas

- **Nenhum comando em shell:** Invocação direta via `child_process.spawn()` com `shell: false`.
- **Proteção de Segredos:** Shared secrets criptografados em repouso com AES-256-GCM.
- **Passagem de Segredo via Arquivo Protegido:** Arquivo temporário criado com `0600` e excluído no bloco `finally`.
- **Sanitização de Logs e Histórico:** Senhas de assinantes e segredos nunca são armazenados na tabela de execuções ou expostos na interface.
- **Controle de Concorrência e Timeout:** Semáforo assíncrono limitando execuções simultâneas e temporizador estrito com `SIGTERM`/`SIGKILL`.
