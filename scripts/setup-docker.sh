#!/bin/bash
# Script de Setup Automático - Supabase Local via Docker (Linux/Mac)
# Execute: chmod +x backend/scripts/setup-docker.sh && ./backend/scripts/setup-docker.sh

set -e

echo "🚀 Configurando Supabase Local via Docker para MOMU"
echo ""

# Verificar se Docker está instalado
echo "📦 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado!"
    echo ""
    echo "Por favor, instale Docker:"
    echo "  https://www.docker.com/products/docker-desktop"
    echo ""
    exit 1
fi

echo "✅ Docker encontrado: $(docker --version)"
echo ""

# Verificar se Docker está rodando
echo "🔍 Verificando se Docker está rodando..."
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker não está rodando!"
    echo "Por favor, inicie o Docker Desktop."
    exit 1
fi

echo "✅ Docker está rodando!"
echo ""

# Navegar para o diretório raiz (onde está o docker-compose.yml)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

# Parar containers existentes (se houver)
echo "🛑 Parando containers existentes (se houver)..."
docker-compose down > /dev/null 2>&1 || true

# Iniciar containers
echo "🚀 Iniciando Supabase Local..."
if ! docker-compose up -d; then
    echo "❌ Erro ao iniciar containers!"
    exit 1
fi

echo "✅ Containers iniciados!"
echo ""

# Aguardar PostgreSQL estar pronto
echo "⏳ Aguardando PostgreSQL estar pronto..."
max_attempts=30
attempt=0
ready=false

while [ $attempt -lt $max_attempts ] && [ "$ready" = false ]; do
    sleep 2
    attempt=$((attempt + 1))
    
    if docker exec supabase_db_momu pg_isready -U postgres > /dev/null 2>&1; then
        ready=true
        echo "✅ PostgreSQL está pronto!"
    else
        echo "   Tentativa $attempt/$max_attempts..."
    fi
done

if [ "$ready" = false ]; then
    echo "❌ PostgreSQL não ficou pronto após $max_attempts tentativas!"
    echo "Verifique os logs com: docker-compose logs postgres"
    exit 1
fi

echo ""

# Verificar se arquivo de migration existe
migration_file="supabase_migration_workspaces.sql"
if [ ! -f "$migration_file" ]; then
    echo "⚠️  Arquivo de migration não encontrado: $migration_file"
    echo "📝 Você precisará executar a migration manualmente."
    echo ""
    echo "Para executar manualmente:"
    echo "  docker exec -i supabase_db_momu psql -U postgres -d postgres < $migration_file"
else
    echo "📋 Executando migration..."
    
    if docker exec -i supabase_db_momu psql -U postgres -d postgres < "$migration_file" > /dev/null 2>&1; then
        echo "✅ Migration executada com sucesso!"
    else
        echo "⚠️  Avisos durante migration (pode ser normal)"
    fi
fi

echo ""
echo "✅ Setup concluído!"
echo ""
echo "🌐 Acesse o Supabase Studio em:"
echo "  http://localhost:3003"
echo ""
echo "📝 Configure o arquivo backend/.env com:"
echo "DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres"
echo ""
echo "🔍 Verificar status dos containers:"
echo "  docker-compose ps"
echo ""
echo "📋 Ver logs:"
echo "  docker-compose logs -f postgres"
echo "  docker-compose logs -f studio"
echo ""
echo "🛑 Parar containers:"
echo "  docker-compose down"
echo ""
echo "🚀 Agora você pode iniciar o backend com: bun run dev"

