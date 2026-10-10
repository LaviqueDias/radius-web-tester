# RADIUS Web Tester — Especificação funcional e técnica

## 1. Objetivo do projeto

Desenvolver uma aplicação Web interna para provedores de Internet que permita montar, validar, enviar e analisar pacotes do protocolo RADIUS utilizando a ferramenta de linha de comando `radclient`.

A aplicação deve oferecer uma interface amigável para que operadores e equipes técnicas possam selecionar um servidor RADIUS autorizado, escolher o tipo de requisição, configurar atributos, enviar o pacote e visualizar a resposta sem precisar executar comandos manualmente no terminal.

**Stacks obrigatórias:**
- **Frontend:** React + TypeScript.
- **Backend:** Node.js + TypeScript.
- **Banco de dados:** PostgreSQL (Docker compose, banco em container).

Tecnologias de apoio recomendadas:
- Vite para iniciar e compilar o frontend.
- Fastify para a API Node.js.
- Zod para validação dos dados.
- Prisma ORM para acesso ao PostgreSQL e migrations.
- Docker Compose para facilitar a execução local e a implantação.
- Tailwind CSS para estilização, caso seja conveniente.

O Antigravity deve implementar uma aplicação funcional, e não apenas telas estáticas. Os fluxos de frontend, API, execução do `radclient` e persistência precisam estar conectados.

---

## 2. Conceito e fluxo principal

O navegador **não executa o `radclient` diretamente**. O backend Node.js é responsável por executar a ferramenta em um servidor Linux com conectividade aos destinos RADIUS.

Fluxo esperado:

1. O usuário acessa a aplicação e realiza login.
2. Seleciona um servidor RADIUS previamente cadastrado e habilitado.
3. Seleciona o tipo de pacote que deseja enviar.
4. A interface exibe os atributos pertinentes ao tipo escolhido.
5. O usuário preenche, adiciona, edita ou remove atributos.
6. Pode validar e visualizar o pacote antes do envio.
7. Ao enviar, o frontend faz uma requisição autenticada para a API.
8. O backend valida a autorização do usuário, o servidor de destino, o tipo de pacote, as opções e os atributos.
9. O backend obtém a referência do segredo compartilhado de forma segura e prepara a entrada do `radclient`.
10. O backend executa o processo sem shell, envia os atributos por `stdin`, captura `stdout` e `stderr` e aplica limites de tempo e saída.
11. A API classifica o resultado sem confundir erro local, timeout, rejeição de autenticação e resposta RADIUS válida.
12. O backend registra os metadados da execução no PostgreSQL, sem registrar segredos ou credenciais sensíveis.
13. O frontend apresenta o resultado detalhado e permite consultar o histórico.

---

## 3. Arquitetura

### 3.1 Frontend — React + TypeScript

Responsabilidades:
- Login e gerenciamento da sessão.
- Dashboard inicial.
- Cadastro e listagem de servidores RADIUS.
- Packet Builder (editor de pacotes).
- Formulários dinâmicos por tipo de pacote.
- Pré-visualização dos atributos.
- Confirmação antes de operações potencialmente disruptivas.
- Exibição dos resultados e erros.
- Histórico de execuções e detalhes de cada teste.
- Gerenciamento de modelos de pacotes.

O frontend pode validar os dados para melhorar a experiência do usuário, mas **a validação do backend é obrigatória e é a fonte de verdade**.

### 3.2 Backend — Node.js + TypeScript

O backend deve ser uma API REST organizada por módulos. Recomenda-se Fastify, Zod e Prisma.

Módulos sugeridos:
- `auth`: login, sessão e autorização.
- `servers`: cadastro, edição, listagem e ativação/desativação de destinos RADIUS.
- `packets`: tipos suportados, validação de atributos e pré-visualização.
- `execution`: execução controlada do `radclient`, captura e classificação do resultado.
- `templates`: modelos reutilizáveis de pacotes.
- `history`: consulta de execuções anteriores.
- `audit`: trilha de auditoria de ações importantes.

### 3.3 Banco — PostgreSQL

Usado para armazenar:
- Usuários e perfis.
- Cadastro de servidores RADIUS e referência à credencial protegida.
- Modelos de pacotes.
- Histórico de execuções e metadados de auditoria.

Não armazenar segredos compartilhados, senhas de assinantes ou credenciais RADIUS em texto puro no banco, nos logs ou no histórico.

### 3.4 Executor — `radclient`

O `radclient` deve estar instalado no ambiente Linux onde o backend executa. O backend precisa ter conectividade de rede até os servidores RADIUS autorizados.

A execução deve utilizar `child_process.spawn()` com `shell: false`, caminho do executável configurado no servidor e argumentos formados pelo backend. Não concatenar dados fornecidos pelo usuário em comandos de shell.

Usar o formato de entrada de atributos documentado pelo FreeRADIUS e enviar o pacote pelo `stdin`. Capturar `stdout`, `stderr`, código de saída, duração e eventos de timeout/erro. Limitar o tamanho máximo da saída e encerrar processos que excedam os limites.

A versão instalada do `radclient` deve ser verificada para confirmar as opções suportadas. Em versões que ofereçam `-S`, pode-se usar um arquivo de segredo protegido com permissões restritas, em vez de passar o segredo na linha de comando. O arquivo deve ser temporário, ter acesso limitado e ser removido de forma segura após o uso. Se for utilizado um cofre de segredos, guardar no banco apenas a referência à credencial.

---

## 4. Tipos de pacotes

A primeira versão deve suportar:

1. **Access-Request** — autenticação; modo do `radclient`: `auth`; porta padrão usual: UDP 1812.
2. **Accounting-Start** — início de contabilização; modo: `acct`; porta padrão usual: UDP 1813.
3. **Accounting-Stop** — encerramento de contabilização; modo: `acct`; porta padrão usual: UDP 1813.
4. **Accounting-Interim-Update** — atualização periódica de contabilização; modo: `acct`; porta padrão usual: UDP 1813.

A aplicação deve permitir configurar as portas por servidor, pois os valores podem variar conforme o ambiente.

Deixar a arquitetura preparada para adicionar em uma etapa posterior:
- CoA-Request.
- Disconnect-Request.

Esses tipos podem alterar ou encerrar sessões reais. Devem ser habilitados somente para destinos autorizados e exigir confirmação explícita na interface.

### 4.1 Atributos

O Packet Builder deve permitir:
- Adicionar atributo.
- Editar atributo.
- Remover atributo.
- Reordenar atributos, se útil.
- Informar nome e valor.
- Exibir os atributos padrão sugeridos para o tipo selecionado.
- Adicionar atributos extras reconhecidos pelo dicionário instalado do FreeRADIUS, desde que aprovados pela política da aplicação.

Atributos iniciais sugeridos para Accounting:
- `User-Name`
- `Acct-Status-Type`
- `Acct-Session-Id`
- `NAS-IP-Address`
- `NAS-Port`
- `NAS-Port-Type`
- `Framed-IP-Address`
- `Calling-Station-Id`
- `Called-Station-Id`
- `Acct-Session-Time`
- `Acct-Input-Octets`
- `Acct-Output-Octets`
- `Acct-Input-Packets`
- `Acct-Output-Packets`
- `Event-Timestamp`, quando aplicável.

Atributos de Access-Request dependem do método de autenticação e do ambiente. Não assumir que qualquer atributo é válido para todos os métodos. Campos de senha devem ser tratados como sensíveis, ocultados na interface quando apropriado e nunca gravados no histórico. A aplicação não deve prometer suportar métodos de autenticação que não tenham sido implementados e testados.

Para Accounting:
- Start deve usar `Acct-Status-Type = Start`.
- Stop deve usar `Acct-Status-Type = Stop`.
- Interim-Update deve usar `Acct-Status-Type = Interim-Update`.

O backend deve verificar consistência entre o tipo selecionado e o valor de `Acct-Status-Type`. Não confiar apenas no valor recebido do frontend.

---

## 5. Servidores RADIUS

Cada servidor cadastrado deve conter:
- Identificador.
- Nome amigável.
- Host/IP.
- Porta de autenticação.
- Porta de accounting.
- Porta de CoA/Disconnect, se futuramente suportadas.
- Referência segura ao shared secret.
- Ambiente (por exemplo, laboratório ou produção).
- Estado habilitado/desabilitado.
- Data de criação e atualização.

O envio deve referenciar um `serverId`, e não aceitar um destino arbitrário fornecido diretamente pelo navegador. O backend deve buscar o destino cadastrado e validar se ele está habilitado e autorizado.

Validar endereços IPv4/IPv6 ou hostname de acordo com a política definida. Para evitar abuso e SSRF, não aceitar destinos livres sem uma política explícita de allowlist. Aplicar também controles de rede no firewall para permitir somente os destinos necessários.

O RADIUS deve estar configurado para reconhecer o IP de origem da aplicação como cliente/NAS autorizado, com o shared secret correspondente. O IP de origem observado pelo servidor deve ser validado durante a implantação, pois Docker, NAT e roteamento podem alterá-lo.

---

## 6. Segurança obrigatória

A aplicação é destinada à rede interna, mas ainda precisa de controles de segurança.

1. **Autenticação obrigatória:** não expor a API de envio sem autenticação.
2. **Autorização:** definir perfis, por exemplo `admin` e `operator`. Apenas administradores podem gerenciar destinos e usuários, conforme a política.
3. **Sessões:** preferir cookies `HttpOnly`, `Secure` em HTTPS e `SameSite` apropriado. Implementar proteção CSRF quando aplicável.
4. **Destinos autorizados:** o usuário não pode fazer a API enviar pacotes para qualquer IP/porta arbitrário.
5. **Sem shell:** executar com `spawn()` e `shell: false`. Não montar comandos a partir de strings controladas pelo usuário.
6. **Credenciais:** não exibir secrets depois de cadastrados, não incluí-los em respostas HTTP, logs, erros ou histórico. Usar cofre de segredos ou criptografia autenticada com chave fora do banco.
7. **Arquivos de segredo:** se necessários, usar diretório restrito, permissões mínimas, nomes aleatórios, limpeza e controle de concorrência. Nunca usar arquivos previsíveis compartilhados entre execuções.
8. **Validação de atributos:** permitir apenas nomes/valores em conformidade com o dicionário e formato esperado. Rejeitar quebras de linha e entradas que permitam injetar atributos adicionais sem intenção.
9. **Limites:** timeout por processo, máximo de processos simultâneos, limite por usuário, tamanho máximo da requisição e limite de saída capturada.
10. **Firewall:** permitir tráfego de saída somente para servidores e portas necessários.
11. **Auditoria:** registrar quem enviou, destino cadastrado, tipo, horário, duração e classificação do resultado. Não registrar senhas ou shared secrets.
12. **Proteção contra operações disruptivas:** CoA/Disconnect devem exigir confirmação, permissões adequadas e destinos autorizados.
13. **Produção:** usar HTTPS, gestão segura de variáveis de ambiente, dependências atualizadas e acesso restrito à VM.

---

## 7. Modelo de dados sugerido

### 7.1 `users`

- `id` — UUID, chave primária.
- `username` — único.
- `password_hash` — hash seguro, nunca senha em texto puro.
- `role` — `admin` ou `operator`.
- `is_active` — boolean.
- `created_at`, `updated_at`.

### 7.2 `radius_servers`

- `id` — UUID, chave primária.
- `name` — nome amigável.
- `host` — IP ou hostname validado.
- `auth_port` — inteiro.
- `accounting_port` — inteiro.
- `coa_port` — opcional.
- `secret_reference` — referência a cofre/segredo protegido, nunca o segredo em texto puro.
- `environment` — por exemplo `lab` ou `production`.
- `is_enabled` — boolean.
- `created_at`, `updated_at`.

### 7.3 `packet_templates`

- `id` — UUID.
- `name`.
- `description` — opcional.
- `packet_type`.
- `attributes_json` — lista de atributos, excluindo secrets e credenciais sensíveis.
- `created_by` — referência a usuário.
- `created_at`, `updated_at`.

### 7.4 `executions`

- `id` — UUID.
- `user_id` — usuário que iniciou o teste.
- `server_id` — servidor de destino.
- `packet_type`.
- `status`.
- `response_code` — opcional.
- `duration_ms`.
- `exit_code` — opcional.
- `stdout_redacted` — saída sanitizada e limitada, se necessária.
- `stderr_redacted` — saída sanitizada e limitada, se necessária.
- `created_at`.

Não armazenar o shared secret, senha de assinante ou pacote completo contendo credenciais sensíveis. Definir política de retenção e permitir expurgo do histórico.

---

## 8. API REST proposta

Todas as rotas, exceto login e recursos públicos estritamente necessários, devem exigir autenticação.

### Autenticação
- `POST /api/auth/login` — autenticar.
- `POST /api/auth/logout` — encerrar sessão.
- `GET /api/auth/me` — obter usuário atual.

### Servidores
- `GET /api/servers` — listar servidores visíveis ao usuário.
- `POST /api/servers` — cadastrar servidor (admin).
- `GET /api/servers/:id` — consultar configuração sem revelar segredo.
- `PATCH /api/servers/:id` — atualizar configuração (admin).
- `POST /api/servers/:id/disable` — desabilitar servidor (admin).

### Pacotes
- `GET /api/packets/types` — listar tipos suportados e atributos sugeridos.
- `POST /api/packets/preview` — validar atributos e retornar uma prévia segura, sem enviar.
- `POST /api/packets/send` — executar o pacote.
- `GET /api/executions` — listar histórico paginado.
- `GET /api/executions/:id` — consultar uma execução autorizada.

### Modelos
- `GET /api/templates` — listar modelos.
- `POST /api/templates` — criar modelo.
- `PATCH /api/templates/:id` — editar modelo.
- `DELETE /api/templates/:id` — excluir modelo.

Usar paginação, filtros e respostas de erro consistentes. Validar a autorização do usuário para cada servidor e execução. Não confiar em identificadores enviados pelo frontend sem verificar a permissão.

### 8.1 Exemplo de envio

Requisição ilustrativa para `POST /api/packets/send`:

```json
{
  "serverId": "UUID-DO-SERVIDOR",
  "packetType": "accounting-start",
  "attributes": [
    { "name": "User-Name", "value": "cliente-teste" },
    { "name": "Acct-Session-Id", "value": "sessao-0001" },
    { "name": "Acct-Status-Type", "value": "Start" },
    { "name": "NAS-IP-Address", "value": "192.168.1.2" }
  ],
  "options": {
    "timeoutSeconds": 3,
    "retries": 1
  }
}
```

O backend deve:
1. Validar o schema e o usuário.
2. Buscar o servidor pelo ID.
3. Verificar se o servidor está habilitado e autorizado.
4. Validar o tipo, os atributos, os limites e as opções.
5. Derivar modo e porta a partir do tipo de pacote e da configuração do servidor.
6. Obter o segredo de forma segura.
7. Executar o `radclient`.
8. Classificar a resposta.
9. Salvar os metadados de auditoria.
10. Retornar resultado sanitizado.

Exemplo ilustrativo de resposta:

```json
{
  "executionId": "UUID-DA-EXECUCAO",
  "status": "response_received",
  "packetType": "accounting-start",
  "destination": "radius-lab-01",
  "durationMs": 42,
  "responseCode": "Accounting-Response",
  "stdout": "Saída sanitizada do radclient",
  "stderr": ""
}
```

Esse contrato é um exemplo para a API; a saída real do `radclient` pode variar por versão. Criar um parser testado para diferenciar resposta RADIUS válida, rejeição, timeout, falha local e resposta não reconhecida. Não concluir que houve sucesso apenas porque o processo terminou com código zero.

---

## 9. Interface e páginas

### 9.1 Login
- Formulário de usuário e senha.
- Mensagens de erro sem revelar se uma conta específica existe.
- Sessão segura.

### 9.2 Dashboard
- Quantidade de servidores habilitados.
- Últimas execuções.
- Resumo de respostas, timeouts e erros.
- Atalhos para criar teste e consultar servidores.

### 9.3 Servidores RADIUS
- Tabela com nome, host, ambiente, portas e estado.
- Formulário para cadastrar e editar.
- Segredo informado apenas na criação ou substituição, sem exibir o valor salvo.
- Ações administrativas restritas.

### 9.4 Packet Builder
- Seleção do servidor cadastrado.
- Seleção do tipo de pacote.
- Campos dinâmicos de atributos.
- Botões para adicionar/remover atributos.
- Validação inline.
- Prévia da entrada que será enviada ao executor.
- Opções de timeout e retentativas com limites.
- Botão de envio com estado de carregamento e prevenção de cliques duplicados.
- Confirmação adicional para operações disruptivas.

### 9.5 Resultado
- Status e código de resposta interpretados.
- Servidor selecionado, tipo e duração.
- Saída técnica expandível, sanitizada e limitada.
- Indicação clara de timeout ou erro.
- Opção de copiar detalhes não sensíveis.

### 9.6 Histórico
- Lista paginada com data, usuário, servidor, tipo, resultado e duração.
- Filtros por período, servidor, tipo e status.
- Detalhes da execução, sem credenciais ou atributos sensíveis.
- Política de retenção configurável.

### 9.7 Modelos
- Salvar atributos como modelo.
- Carregar modelo no Packet Builder.
- Editar, duplicar e remover.
- Nunca salvar credenciais ou senhas sensíveis em templates.

---

## 10. Classificação dos resultados

O backend deve normalizar os resultados em estados que não gerem ambiguidade:

- `response_received`: resposta RADIUS válida recebida.
- `rejected`: resposta válida de rejeição, como `Access-Reject`.
- `timeout`: nenhuma resposta válida recebida dentro do limite.
- `execution_error`: falha ao iniciar ou executar o processo.
- `invalid_response`: houve saída ou resposta, mas ela não pôde ser classificada com segurança.
- `cancelled`: execução cancelada, se a aplicação implementar cancelamento.

A classificação deve considerar o tipo de pacote. `Access-Accept` e `Access-Reject` são respostas de autenticação; `Accounting-Response` é uma resposta de accounting. Uma rejeição de autenticação não é um erro de execução. Da mesma forma, uma resposta de accounting não deve ser interpretada como prova de que todos os sistemas posteriores processaram a contabilização.

O parser deve ter testes automatizados usando amostras reais de saída das versões suportadas do `radclient`.

---

## 11. Testes necessários

### Testes unitários
- Validação de tipos de pacote.
- Validação e normalização de atributos.
- Regras de `Acct-Status-Type`.
- Validação de porta e destino.
- Sanitização de logs e respostas.
- Parser de `stdout` e `stderr`.

### Testes de integração
- API com PostgreSQL de teste.
- Executor usando um mock controlado do processo.
- Timeout e encerramento de processo.
- Processo ausente ou falha ao iniciar.
- Respostas válidas, rejeições e respostas não reconhecidas.
- Autenticação e autorização por perfil.

### Testes em laboratório
- Access-Request válido.
- Access-Request rejeitado.
- Accounting-Start.
- Accounting-Stop.
- Accounting-Interim-Update.
- Shared secret incorreto.
- Servidor inacessível.
- Porta errada.
- Timeout.
- Destino não autorizado.
- Tentativa de injeção por nome/valor de atributo.
- Limites de concorrência e tamanho de saída.

Não executar testes disruptivos em produção sem autorização explícita.

---

## 12. Implantação

A aplicação será instalada em uma VM Linux da rede interna do provedor.

Sugestão:
- Container frontend para servir os arquivos estáticos.
- Container backend com Node.js e `radclient` instalado.
- Container PostgreSQL em rede interna Docker, sem expor a porta do banco desnecessariamente.
- Proxy reverso para HTTPS, se necessário.
- Volume persistente para dados do PostgreSQL.
- Segredos de produção fornecidos por um mecanismo seguro de configuração.
- Firewall permitindo acesso Web apenas às redes administrativas e tráfego RADIUS de saída apenas para destinos autorizados.

O backend deve ter permissões mínimas. Não executar como root sem necessidade. Validar qual IP de origem o servidor RADIUS enxerga, especialmente quando houver Docker, NAT ou múltiplas interfaces.

Criar:
- `Dockerfile` para frontend e backend.
- `docker-compose.yml`.
- `.env.example` sem credenciais reais.
- Migrations do Prisma.
- Health check para API e banco.
- Instruções de instalação, atualização, backup e restauração no `README.md`.

Nunca commitar arquivos `.env`, secrets, dumps de produção ou credenciais no Git.

---

## 13. Organização de diretórios sugerida

```text
radius-web-tester/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── servers/
│   │       │   ├── packet-builder/
│   │       │   ├── executions/
│   │       │   └── templates/
│   │       ├── services/
│   │       └── types/
│   └── api/
│       └── src/
│           ├── modules/
│           │   ├── auth/
│           │   ├── servers/
│           │   ├── packets/
│           │   ├── execution/
│           │   ├── templates/
│           │   ├── history/
│           │   └── audit/
│           ├── plugins/
│           ├── lib/
│           └── app.ts
├── packages/
│   └── shared/
│       └── src/
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── .env.example
└── README.md
```

A estrutura pode ser adaptada se o agente escolher uma organização equivalente, desde que mantenha a separação clara entre frontend, API, persistência e executor.

---

## 14. Plano de implementação por etapas

### Etapa 1 — Fundação
- Criar a estrutura React e Node.js com TypeScript.
- Subir PostgreSQL e configurar Prisma.
- Instalar e validar o `radclient` em ambiente Linux.
- Documentar como configurar um servidor RADIUS de laboratório.

### Etapa 2 — Primeiro fluxo ponta a ponta
- Implementar um cadastro mínimo de servidor autorizado.
- Criar o endpoint de prévia.
- Implementar o executor seguro.
- Enviar um Accounting-Start/Stop em laboratório.
- Exibir a resposta real na interface.

### Etapa 3 — Packet Builder
- Implementar formulários dinâmicos.
- Adicionar e remover atributos.
- Validar tipos e valores.
- Adicionar Access-Request e Accounting-Interim-Update.
- Tratar respostas, timeouts e erros.

### Etapa 4 — Segurança e persistência
- Implementar login e perfis.
- Proteger secrets.
- Persistir servidores, templates e histórico.
- Implementar auditoria e limites de execução.

### Etapa 5 — Qualidade
- Adicionar testes unitários, integração e laboratório.
- Testar autorização e destinos não permitidos.
- Validar sanitização de logs.
- Testar concorrência, timeout e encerramento de processos.

### Etapa 6 — Implantação e evolução
- Docker Compose e documentação.
- Implantação restrita em rede interna.
- Coleta de feedback dos operadores.
- Depois, considerar CoA, Disconnect, exportação e recursos avançados.

---

## 15. Critérios de aceite do MVP

O MVP só deve ser considerado concluído quando:

- [ ] O usuário consegue autenticar-se.
- [ ] É possível cadastrar e selecionar um servidor autorizado.
- [ ] É possível montar um Access-Request e pacotes de accounting.
- [ ] É possível adicionar, editar e remover atributos.
- [ ] A prévia corresponde aos atributos que serão enviados.
- [ ] O backend executa o `radclient` sem shell e sem expor o segredo na linha de comando.
- [ ] A resposta real, timeout ou falha local aparece claramente.
- [ ] Os resultados são classificados de forma coerente com o tipo de pacote.
- [ ] O histórico é persistido sem credenciais sensíveis.
- [ ] Destinos arbitrários e requisições não autorizadas são bloqueados.
- [ ] Há limites de tempo, concorrência e saída.
- [ ] A aplicação pode ser executada seguindo o README e o Docker Compose.
- [ ] Os principais fluxos têm testes automatizados.

---

## 16. Instruções diretas para o Antigravity

Implemente este projeto como uma aplicação full-stack funcional usando React + TypeScript no frontend, Node.js + TypeScript no backend e PostgreSQL como banco.

Prioridades:
1. Leia esta especificação e crie um plano de implementação antes de alterar os arquivos.
2. Inspecione o ambiente disponível e não presuma que o `radclient` ou um servidor RADIUS já estejam instalados.
3. Construa primeiro um fluxo funcional de ponta a ponta, começando por laboratório.
4. Use Fastify, Zod e Prisma, salvo se houver uma razão técnica concreta para uma alternativa.
5. Não implemente uma interface apenas demonstrativa: conecte os formulários à API e ao banco.
6. Nunca execute comandos montados por concatenação de entradas do usuário. Use `spawn()` com `shell: false`.
7. Não aceite destinos RADIUS arbitrários: use servidores cadastrados e habilitados, além de regras de rede.
8. Não exponha nem grave shared secrets ou senhas em logs, respostas ou histórico.
9. Implemente timeout, limites de concorrência, limite de saída e encerramento de processos.
10. Crie migrations, `.env.example`, Dockerfiles, Docker Compose, testes e documentação.
11. Se faltar conectividade a um servidor RADIUS real, implemente testes automatizados com mocks e documente claramente como realizar a validação em laboratório. Não simule sucesso real na interface.
12. Não habilite CoA ou Disconnect por padrão; deixe-os para uma etapa posterior com controles de segurança.
13. Ao concluir cada etapa, informe os arquivos criados, decisões técnicas, comandos para executar e testes realizados.
14. Não coloque segredos reais no código, no Git ou em exemplos de configuração.
15. Preserve a separação entre interface, API, lógica de pacotes, executor do `radclient` e persistência.

**Resultado esperado:** uma aplicação interna utilizável para montar, enviar e diagnosticar pacotes RADIUS com segurança, com interface React, API Node.js/TypeScript, persistência PostgreSQL e execução real do `radclient` no servidor autorizado.
