import { config } from "dotenv";

// Carregar .env padrão
config();

// Em desenvolvimento, carregar .env.local (sobrescreve .env)
if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.development" }); // sobrescreve .env

  console.log("🔍 Variáveis de ambiente carregadas:");
  console.log(process.env.DATABASE_URL);
}
