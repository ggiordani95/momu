import postgres from "postgres";

// Usar SUPABASE_POOL_URL para connection pooling (porta 6543)
// Isso reduz significativamente os CONNECT_TIMEOUT aleatórios
// Fallback para DATABASE_URL ou PostgreSQL local
let connectionString =
  process.env.SUPABASE_POOL_URL ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/momu";

// Se estiver usando DATABASE_URL do Supabase (porta 5432), converter para pooler (6543)
if (
  connectionString.includes("supabase.co") &&
  connectionString.includes(":5432/")
) {
  console.warn(
    "⚠️  Usando DATABASE_URL com porta 5432. Convertendo para pooler (6543)..."
  );
  connectionString = connectionString.replace(":5432/", ":6543/");
}

// Detectar se está usando Supabase
const isSupabase = connectionString.includes("supabase.co");

// Log da configuração (sem expor senha)
if (isSupabase) {
  const maskedUrl = connectionString.replace(/:[^:@]+@/, ":****@");
  const poolType = connectionString.includes(":6543")
    ? "Pool (6543)"
    : "Direct (5432)";
  console.log(`🔌 Conectando ao Supabase (${poolType}):`, maskedUrl);
} else {
  console.log("🔌 Conectando ao PostgreSQL local");
}

// Configuração do postgres.js otimizada para Supabase Pool
// Usar connection pooler (porta 6543) reduz timeouts
export const sql = postgres(connectionString, {
  max: 1, // Reduzir para 1 conexão para evitar esgotamento de slots
  idle_timeout: 0, // Nunca fechar conexões idle (keep-alive)
  connect_timeout: 60, // Timeout muito aumentado (60 segundos)
  ssl: isSupabase ? "require" : undefined, // SSL obrigatório para Supabase
  onnotice: () => {}, // Suprimir avisos do PostgreSQL
  connection: {
    application_name: "momu-backend",
  },
  transform: {
    undefined: null,
  },
  // Retry automático em queries
  max_lifetime: 60 * 30, // 30 minutos
});

// Wrapper para queries com retry automático
const queryWithRetry = async <T>(
  queryFn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (error: any) {
      const isTimeout =
        error?.message?.includes("CONNECT_TIMEOUT") ||
        error?.message?.includes("timeout");

      if (isTimeout && i < retries - 1) {
        const backoffDelay = delay * Math.pow(2, i); // Backoff exponencial
        console.warn(
          `⚠️  Query falhou (tentativa ${
            i + 1
          }/${retries}), tentando novamente em ${backoffDelay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
};

// Keep-alive: executar query periódica para manter conexões vivas
if (isSupabase) {
  setInterval(async () => {
    try {
      await queryWithRetry(() => sql`SELECT 1`, 2, 500);
    } catch (error) {
      // Silenciar erros de keep-alive para não poluir logs
    }
  }, 20000); // A cada 20 segundos (mais frequente)
}

// Testar conexão na inicialização com retry e backoff exponencial
const testConnection = async () => {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await queryWithRetry(() => sql`SELECT 1`, 1, 0);
      console.log("✅ Conexão com banco de dados estabelecida!");
      return;
    } catch (error: any) {
      if (i < maxRetries - 1) {
        const backoffDelay = 2000 * Math.pow(2, i); // Backoff exponencial: 2s, 4s, 8s, 16s
        console.warn(
          `⚠️  Tentativa ${
            i + 1
          }/${maxRetries} falhou, tentando novamente em ${backoffDelay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      } else {
        console.error(
          "❌ Erro ao conectar com banco de dados após",
          maxRetries,
          "tentativas:",
          error.message
        );
        console.error(
          "   Verifique SUPABASE_POOL_URL ou DATABASE_URL no arquivo .env"
        );
        console.error(
          "   Para Supabase, use a porta 6543 (pooler) ao invés de 5432 (direct)"
        );
        console.error(
          "   Se o Supabase estiver hibernado, pode levar alguns segundos para 'acordar'"
        );
      }
    }
  }
};

testConnection();

// Helper function para queries com retry automático
// Use esta função para queries críticas que precisam de retry
export const sqlWithRetry = async <T>(
  queryFn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  return queryWithRetry(queryFn, retries, delay);
};

export default sql;
