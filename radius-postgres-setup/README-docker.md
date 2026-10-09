# PostgreSQL para RADIUS Web Tester

## Pré-requisitos

- Docker Engine instalado e em execução.
- Docker Compose v2 (`docker compose version`).

## Iniciar

1. Entre neste diretório.
2. Crie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   nano .env
   ```

3. Troque `POSTGRES_PASSWORD` por uma senha forte. Não compartilhe nem versione o arquivo `.env`.
4. Inicie o banco:

   ```bash
   docker compose up -d
   ```

5. Confira o estado:

   ```bash
   docker compose ps
   docker compose logs -f postgres
   ```

6. Teste a conexão dentro do container:

   ```bash
   docker compose exec postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   ```

## Configuração para a aplicação Node.js

Como a porta está vinculada a `127.0.0.1`, o banco só aceita conexões originadas no próprio Ubuntu. Para backend Node.js executado diretamente no Ubuntu, uma URL de exemplo é:

```text
DATABASE_URL=postgresql://radius_app:SENHA_URL_ENCODED@127.0.0.1:5432/radius_web?schema=public
```

Substitua a senha pela senha real. Se ela contiver caracteres especiais, faça URL-encoding para usar na URL de conexão.

Se o backend Node.js também for colocado em um container Docker Compose, use uma rede Compose compartilhada e o hostname `postgres` como host da conexão (porta `5432`), em vez de `127.0.0.1`. Não publique a porta do PostgreSQL para toda a rede sem necessidade.

## Comandos úteis

```bash
# Parar os containers sem apagar os dados
docker compose down

# Reiniciar
docker compose restart postgres

# Acessar o psql
docker compose exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Acompanhar logs
docker compose logs -f postgres
```

**Atenção:** `docker compose down -v` remove o volume e apaga os dados persistidos. Não use esse comando se quiser preservar o banco.

## Segurança

- O arquivo `.env` contém credenciais: mantenha-o fora do Git.
- O Compose publica a porta apenas no loopback (`127.0.0.1`).
- Faça backups regulares antes de usar com dados importantes.
