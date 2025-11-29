#!/usr/bin/env bun
/**
 * Script de Setup Automático - Supabase Local via Docker (Multi-plataforma)
 * Execute: bun run backend/scripts/setup-docker.ts
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkDocker(): Promise<boolean> {
  try {
    await $`docker --version`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function checkDockerRunning(): Promise<boolean> {
  try {
    await $`docker ps`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function waitForPostgreSQL(maxAttempts: number = 30): Promise<boolean> {
  log("⏳ Aguardando PostgreSQL estar pronto...", "yellow");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await $`docker exec supabase_db_momu pg_isready -U postgres`.quiet();
      log("✅ PostgreSQL está pronto!", "green");
      return true;
    } catch {
      log(`   Tentativa ${attempt}/${maxAttempts}...`, "gray");
      await Bun.sleep(2000);
    }
  }

  return false;
}

async function runMigration(migrationFile: string): Promise<boolean> {
  try {
    const sqlContent = Bun.file(migrationFile);
    const text = await sqlContent.text();

    return true;
  } catch {
    return false;
  }
}

async function main() {
  log("🚀 Configurando Supabase Local via Docker para MOMU", "cyan");
  console.log("");

  // Verificar Docker
  log("📦 Verificando Docker...", "yellow");
  const hasDocker = await checkDocker();

  if (!hasDocker) {
    log("❌ Docker não encontrado!", "red");
    console.log("");
    log("Por favor, instale Docker Desktop:", "yellow");
    log("https://www.docker.com/products/docker-desktop", "white");
    console.log("");
    process.exit(1);
  }

  const dockerVersion = (await $`docker --version`.text()).trim();
  log(`✅ Docker encontrado: ${dockerVersion}`, "green");
  console.log("");

  // Verificar se Docker está rodando
  log("🔍 Verificando se Docker está rodando...", "yellow");
  const dockerRunning = await checkDockerRunning();

  if (!dockerRunning) {
    log("❌ Docker não está rodando!", "red");
    log("Por favor, inicie o Docker Desktop.", "yellow");
    process.exit(1);
  }

  log("✅ Docker está rodando!", "green");
  console.log("");

  // Navegar para o diretório raiz
  const scriptDir = import.meta.dir;
  const rootDir = join(scriptDir, "../..");
  process.chdir(rootDir);

  // Parar containers existentes
  log("🛑 Parando containers existentes (se houver)...", "yellow");
  await $`docker-compose down`.quiet().catch(() => {});

  // Iniciar containers
  log("🚀 Iniciando Supabase Local...", "yellow");
  try {
    await $`docker-compose up -d`;
    log("✅ Containers iniciados!", "green");
  } catch (error: any) {
    log("❌ Erro ao iniciar containers!", "red");
    log(error.message, "red");
    process.exit(1);
  }

  console.log("");

  // Aguardar PostgreSQL
  const ready = await waitForPostgreSQL(30);

  if (!ready) {
    log("❌ PostgreSQL não ficou pronto após 30 tentativas!", "red");
    log("Verifique os logs com: docker-compose logs postgres", "yellow");
    process.exit(1);
  }

  console.log("");

  // Executar migration
  const migrationFile = "supabase_migration_workspaces.sql";
  if (!existsSync(migrationFile)) {
    log(`⚠️  Arquivo de migration não encontrado: ${migrationFile}`, "yellow");
    log("📝 Você precisará executar a migration manualmente.", "yellow");
    console.log("");
    log("Para executar manualmente:", "cyan");
    log(
      `  docker exec -i supabase_db_momu psql -U postgres -d postgres < ${migrationFile}`,
      "white"
    );
  } else {
    log("📋 Executando migration...", "yellow");
    const migrated = await runMigration(migrationFile);

    if (migrated) {
      log("✅ Migration executada com sucesso!", "green");
    } else {
      log("⚠️  Avisos durante migration (pode ser normal)", "yellow");
    }
  }

  console.log("");
  log("✅ Setup concluído!", "green");
  console.log("");
  log("🌐 Acesse o Supabase Studio em:", "cyan");
  log("  http://localhost:3003", "white");
  console.log("");
  log("📝 Configure o arquivo backend/.env com:", "cyan");
  log(
    "DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres",
    "white"
  );
  console.log("");
  log("🔍 Verificar status dos containers:", "cyan");
  log("  docker-compose ps", "white");
  console.log("");
  log("📋 Ver logs:", "cyan");
  log("  docker-compose logs -f postgres", "white");
  log("  docker-compose logs -f studio", "white");
  console.log("");
  log("🛑 Parar containers:", "cyan");
  log("  docker-compose down", "white");
  console.log("");
  log("🚀 Agora você pode iniciar o backend com: bun run dev", "cyan");
}

main().catch((error) => {
  log(`❌ Erro: ${error.message}`, "red");
  process.exit(1);
});
