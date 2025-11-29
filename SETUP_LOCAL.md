# Setup Supabase Local

## 🐳 Setup Automático via Docker (Recomendado)

### Windows (PowerShell):

```powershell
cd backend
bun run setup:docker:windows
# ou
.\scripts\setup-docker.ps1
```

### Linux/Mac (Bash):

```bash
cd backend
chmod +x scripts/setup-docker.sh
bun run setup:docker:unix
# ou
./scripts/setup-docker.sh
```

### Multi-plataforma (Bun):

```bash
cd backend
bun run setup:docker
```

O script irá:

- ✅ Verificar se Docker está instalado e rodando
- ✅ Iniciar o container PostgreSQL do Supabase
- ✅ Aguardar o banco estar pronto
- ✅ Executar as migrations automaticamente
- ✅ Mostrar a configuração do `.env`

**Configuração do `.env` após o setup:**

```env
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres
```

**Comandos úteis:**

```bash
# Ver status dos containers
docker-compose ps

# Ver logs
docker-compose logs -f postgres

# Parar containers
docker-compose down

# Parar e remover dados
docker-compose down -v
```

---

## 🚀 Setup Automático - PostgreSQL Local (Sem Docker)

### Windows (PowerShell):

```powershell
cd backend
bun run setup:local:windows
# ou
.\scripts\setup-local.ps1
```

### Linux/Mac (Bash):

```bash
cd backend
chmod +x scripts/setup-local.sh
bun run setup:local:unix
# ou
./scripts/setup-local.sh
```

### Multi-plataforma (Bun):

```bash
cd backend
bun run setup:local
```

O script irá:

- ✅ Verificar se PostgreSQL está instalado
- ✅ Criar o banco de dados `momu`
- ✅ Executar as migrations automaticamente
- ✅ Mostrar a configuração do `.env`

---

## Opção 1: PostgreSQL Local Simples (Recomendado para desenvolvimento)

### 1. Instalar PostgreSQL

**Windows:**

- Baixe do site oficial: https://www.postgresql.org/download/windows/
- Ou use Chocolatey: `choco install postgresql`

**Mac:**

```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux:**

```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Criar banco de dados

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar banco de dados
CREATE DATABASE momu;

# Sair
\q
```

### 3. Configurar .env

No arquivo `backend/.env`, use:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/momu
```

### 4. Rodar migrations

Execute o arquivo SQL de migration no banco:

```bash
psql -U postgres -d momu -f supabase_migration_workspaces.sql
```

Ou copie e cole o conteúdo do arquivo SQL no psql.

---

## Opção 2: Supabase Local via Docker (Mais completo)

### 1. Instalar Docker

- Windows/Mac: https://www.docker.com/products/docker-desktop
- Linux: `sudo apt-get install docker.io docker-compose`

### 2. Iniciar Supabase Local

```bash
# Na raiz do projeto
docker-compose up -d
```

### 3. Aguardar inicialização

Aguarde alguns segundos para o PostgreSQL inicializar. Verifique com:

```bash
docker-compose ps
```

### 4. Configurar .env

No arquivo `backend/.env`, use:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres
```

**Nota:** A porta é `54322` (não `5432`) para evitar conflito com PostgreSQL local.

### 5. Rodar migrations

```bash
# Conectar ao banco
psql -U postgres -h localhost -p 54322 -d postgres

# Ou executar o arquivo SQL
psql -U postgres -h localhost -p 54322 -d postgres -f supabase_migration_workspaces.sql
```

### 6. Parar Supabase Local

```bash
docker-compose down
```

Para remover os dados também:

```bash
docker-compose down -v
```

---

## Verificar Conexão

Teste a conexão:

```bash
cd backend
bun run test:connection
```

---

## Vantagens de cada opção

**PostgreSQL Local:**

- ✅ Mais simples
- ✅ Mais rápido
- ✅ Não precisa de Docker
- ❌ Não tem todas as features do Supabase (auth, storage, etc)

**Supabase Local:**

- ✅ Mais próximo do ambiente de produção
- ✅ Inclui todas as features do Supabase
- ✅ Fácil de resetar (docker-compose down -v)
- ❌ Precisa de Docker
- ❌ Mais pesado

Para desenvolvimento básico, recomendo **PostgreSQL Local**.
