# 🚀 Como Conectar o Supabase

## Passo 1: Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com) e faça login
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `momu` (ou outro nome)
   - **Database Password**: Crie uma senha forte ⚠️ **ANOTE ELA!**
   - **Region**: Escolha a mais próxima (ex: South America)
4. Clique em **"Create new project"** e aguarde ~2 minutos

## Passo 2: Obter Connection String

1. No dashboard do Supabase, vá em **Settings** (⚙️) → **Database**
2. Role até **Connection string**
3. Selecione a aba **URI**
4. Copie a string que aparece. Formato:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## Passo 3: Configurar .env

1. No diretório `backend/`, crie o arquivo `.env`:

   ```bash
   cd backend
   # No Windows PowerShell:
   New-Item .env
   # Ou crie manualmente
   ```

2. Adicione no arquivo `.env`:

   ```env
   DATABASE_URL=postgresql://postgres:SUA_SENHA_AQUI@db.SEU_PROJECT_REF.supabase.co:5432/postgres?sslmode=require
   ```

   **Substitua:**

   - `SUA_SENHA_AQUI` → A senha que você criou no Passo 1
   - `SEU_PROJECT_REF` → O ID do projeto (aparece na URL: `https://app.supabase.com/project/SEU_PROJECT_REF`)

   **Exemplo real:**

   ```env
   DATABASE_URL=postgresql://postgres:MinhaSenh@123@db.abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require
   ```

## Passo 4: Criar Tabelas no Supabase

1. No Supabase, vá em **SQL Editor** (no menu lateral)
2. Clique em **"New query"**
3. Cole este SQL e clique em **"Run"**:

```sql
-- Tabela de Tópicos
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_color TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Itens dos Tópicos
CREATE TABLE IF NOT EXISTS topic_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES topic_items(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  youtube_url TEXT,
  youtube_id TEXT,
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_topic_items_topic_id ON topic_items(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_items_parent_id ON topic_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_topic_items_order_index ON topic_items(order_index);
```

4. Você deve ver: ✅ "Success. No rows returned"

## Passo 5: Testar

1. Inicie o backend:

   ```bash
   cd backend
   bun run dev
   ```

2. Você deve ver:

   ```
   🦊 Elysia is running at localhost:3001
   ```

3. Teste criando um tópico (no frontend ou via curl):

   ```bash
   curl -X POST http://localhost:3001/topics \
     -H "Content-Type: application/json" \
     -d '{"title":"Teste","description":"Testando Supabase"}'
   ```

4. Verifique no Supabase: **Table Editor** → `topics` → deve aparecer o novo tópico!

## ✅ Pronto!

Agora todas as operações do frontend serão persistidas no Supabase:

- ✅ Criar/editar/deletar tópicos
- ✅ Criar/editar/deletar itens
- ✅ Drag and drop (reordenar)
- ✅ Rich text editor
- ✅ Tarefas completas

## 🔍 Ver Dados no Supabase

- **Table Editor**: Veja e edite dados manualmente
- **SQL Editor**: Execute queries customizadas
- **Database**: Veja estrutura das tabelas

## ⚠️ Troubleshooting

**Erro: "Connection refused"**

- Verifique se `.env` existe e tem a connection string correta
- Certifique-se de adicionar `?sslmode=require` no final

**Erro: "password authentication failed"**

- Verifique se a senha está correta
- Você pode resetar em: Settings → Database → Reset database password

**Erro: "relation does not exist"**

- Execute o SQL do Passo 4 novamente
- Verifique se está no projeto correto do Supabase

**Tabelas não aparecem**

- Verifique se executou o SQL do Passo 4
- No Table Editor, clique em "Refresh"
