# Script de Setup Automático - Supabase Local via Docker (Windows PowerShell)
# Execute: .\backend\scripts\setup-docker.ps1

Write-Host "🚀 Configurando Supabase Local via Docker para MOMU" -ForegroundColor Cyan
Write-Host ""

# Verificar se Docker está instalado
Write-Host "📦 Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker não encontrado"
    }
    Write-Host "✅ Docker encontrado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, instale Docker Desktop:" -ForegroundColor Yellow
    Write-Host "https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Verificar se Docker está rodando
Write-Host "🔍 Verificando se Docker está rodando..." -ForegroundColor Yellow
try {
    docker ps > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker não está rodando"
    }
    Write-Host "✅ Docker está rodando!" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não está rodando!" -ForegroundColor Red
    Write-Host "Por favor, inicie o Docker Desktop." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Navegar para o diretório raiz (onde está o docker-compose.yml)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath
$rootPath = Split-Path -Parent $rootPath
Set-Location $rootPath

# Parar containers existentes (se houver)
Write-Host "🛑 Parando containers existentes (se houver)..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null

# Iniciar containers
Write-Host "🚀 Iniciando Supabase Local..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao iniciar containers!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Containers iniciados!" -ForegroundColor Green
Write-Host ""

# Aguardar PostgreSQL estar pronto
Write-Host "⏳ Aguardando PostgreSQL estar pronto..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    Start-Sleep -Seconds 2
    $attempt++
    
    try {
        $result = docker exec supabase_db_momu pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            Write-Host "✅ PostgreSQL está pronto!" -ForegroundColor Green
        } else {
            Write-Host "   Tentativa $attempt/$maxAttempts..." -ForegroundColor Gray
        }
    } catch {
        Write-Host "   Tentativa $attempt/$maxAttempts..." -ForegroundColor Gray
    }
}

if (-not $ready) {
    Write-Host "❌ PostgreSQL não ficou pronto após $maxAttempts tentativas!" -ForegroundColor Red
    Write-Host "Verifique os logs com: docker-compose logs postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Verificar se arquivo de migration existe
$migrationFile = "supabase_migration_workspaces.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "⚠️  Arquivo de migration não encontrado: $migrationFile" -ForegroundColor Yellow
    Write-Host "📝 Você precisará executar a migration manualmente." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para executar manualmente:" -ForegroundColor Cyan
    Write-Host "  docker exec -i supabase_db_momu psql -U postgres -d postgres < $migrationFile" -ForegroundColor White
} else {
    Write-Host "📋 Executando migration..." -ForegroundColor Yellow
    
    # Ler arquivo SQL e executar
    $sqlContent = Get-Content $migrationFile -Raw
    $sqlContent | docker exec -i supabase_db_momu psql -U postgres -d postgres 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration executada com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Avisos durante migration (pode ser normal)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Setup concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Acesse o Supabase Studio em:" -ForegroundColor Cyan
Write-Host "  http://localhost:3003" -ForegroundColor White
Write-Host ""
Write-Host "📝 Configure o arquivo backend/.env com:" -ForegroundColor Cyan
Write-Host "DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Verificar status dos containers:" -ForegroundColor Cyan
Write-Host "  docker-compose ps" -ForegroundColor White
Write-Host ""
Write-Host "📋 Ver logs:" -ForegroundColor Cyan
Write-Host "  docker-compose logs -f postgres" -ForegroundColor White
Write-Host "  docker-compose logs -f studio" -ForegroundColor White
Write-Host ""
Write-Host "🛑 Parar containers:" -ForegroundColor Cyan
Write-Host "  docker-compose down" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Agora você pode iniciar o backend com: bun run dev" -ForegroundColor Cyan

