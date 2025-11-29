# 🔧 Configuração de Variáveis de Ambiente

O backend suporta múltiplos arquivos de configuração para diferentes ambientes.

## 📁 Arquivos de Configuração

### Prioridade (maior para menor):

1. **Variáveis de ambiente do sistema** - Configurações do sistema operacional (prioridade máxima)
2. **`.env.local`** - Configurações locais de desenvolvimento (sobrescreve `.env`, não commitado)
3. **`.env`** - Configuração padrão (pode ser commitado com valores de exemplo)

## 🚀 Uso

### Para Desenvolvimento Local

Crie um arquivo `.env.local` na raiz do diretório `backend/`:

```env
# Banco de dados local (Supabase CLI)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Ou use o pooler do Supabase (se estiver usando Supabase na nuvem)
# SUPABASE_POOL_URL=postgresql://postgres:senha@db.projeto.supabase.co:6543/postgres
```

### Para Produção

Use variáveis de ambiente do sistema ou um arquivo `.env`:

```env
# Supabase na nuvem
DATABASE_URL=postgresql://postgres:senha@db.projeto.supabase.co:5432/postgres?sslmode=require
```

## 📝 Variáveis Disponíveis

- `DATABASE_URL` - URL de conexão do PostgreSQL
- `SUPABASE_POOL_URL` - URL do connection pooler do Supabase (porta 6543)

## ⚠️ Importante

- O arquivo `.env.local` está no `.gitignore` e **não será commitado**
- Use `.env.local` para configurações pessoais de desenvolvimento
- Use `.env` para configurações compartilhadas (com valores de exemplo)
- Nunca commite senhas ou tokens reais no `.env`

## 🔄 Como Funciona

O arquivo `src/env.ts` carrega automaticamente os arquivos `.env` na ordem de prioridade quando o backend inicia:

1. Primeiro carrega `.env` (base)
2. Depois carrega `.env.local` (sobrescreve `.env`)
3. Variáveis do sistema **nunca são sobrescritas** por arquivos `.env`

**Exemplo:**

- `.env` tem: `DATABASE_URL=postgresql://...@nuvem:5432/postgres`
- `.env.local` tem: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Resultado: Usa a URL do `.env.local` (local) ✅
