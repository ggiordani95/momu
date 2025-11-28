# Guia de Configuração do Supabase

## Passo 1: Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em "New Project"
4. Preencha:
   - **Name**: Nome do seu projeto (ex: "momu")
   - **Database Password**: Crie uma senha forte (anote ela!)
   - **Region**: Escolha a região mais próxima
5. Clique em "Create new project"

## Passo 2: Obter Connection String

1. No dashboard do Supabase, vá em **Settings** → **Database**
2. Role até a seção **Connection string**
3. Selecione **URI** (não Transaction)
4. Copie a connection string. Ela terá este formato:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## Passo 3: Configurar Variável de Ambiente

1. No diretório `backend/`, crie um arquivo `.env`:

   ```bash
   cd backend
   touch .env
   ```

2. Adicione a connection string no arquivo `.env`:

   ```env
   DATABASE_URL=postgresql://postgres:SUA_SENHA@db.SEU_PROJECT_REF.supabase.co:5432/postgres?sslmode=require
   ```

   **Importante**: Substitua:

   - `SUA_SENHA` pela senha que você criou no Passo 1
   - `SEU_PROJECT_REF` pelo ID do seu projeto (aparece na URL do dashboard)

## Passo 4: Criar Tabelas no Supabase

Você tem duas opções:

### Opção A: Usar o SQL Editor do Supabase (Recomendado)

1. No dashboard do Supabase, vá em **SQL Editor**
2. Clique em **New query**
3. Cole o seguinte SQL:

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

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_topic_items_topic_id ON topic_items(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_items_parent_id ON topic_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_topic_items_order_index ON topic_items(order_index);
```

4. Clique em **Run** para executar

### Opção B: Usar o Script de Inicialização

1. No Supabase, vá em **SQL Editor**
2. Execute o script `backend/src/init_db.ts` manualmente (copie o SQL de lá)

## Passo 5: Testar a Conexão

1. Certifique-se de que o arquivo `.env` está criado com a connection string correta
2. Inicie o backend:

   ```bash
   cd backend
   bun run dev
   ```

3. Você deve ver:

   ```
   🦊 Elysia is running at localhost:3001
   ```

4. Teste fazendo uma requisição:
   ```bash
   curl http://localhost:3001/topics
   ```

## Troubleshooting

### Erro: "Connection refused"

- Verifique se a connection string está correta
- Certifique-se de que adicionou `?sslmode=require` no final da URL
- Verifique se a senha está correta

### Erro: "relation does not exist"

- Execute o SQL de criação de tabelas no Supabase SQL Editor
- Verifique se você está conectado ao banco correto

### Erro: "password authentication failed"

- Verifique se a senha no `.env` está correta
- Você pode resetar a senha em **Settings** → **Database** → **Reset database password**

## Segurança

⚠️ **IMPORTANTE**:

- Nunca commite o arquivo `.env` no Git
- O arquivo `.env` já está no `.gitignore`
- Use variáveis de ambiente diferentes para desenvolvimento e produção

## Próximos Passos

Após conectar o Supabase:

1. ✅ Teste criar um tópico
2. ✅ Teste criar itens
3. ✅ Teste atualizar e deletar itens
4. ✅ Verifique os dados no dashboard do Supabase em **Table Editor**
