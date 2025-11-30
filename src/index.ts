// Carregar variáveis de ambiente (incluindo .env.local) antes de tudo
import "./env";

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { filesRoutes, fileRoutes } from "./routes/files";
import { trashRoutes } from "./routes/trash";
import { workspacesRoutes } from "./routes/workspaces";

const app = new Elysia()
  .use(cors())
  .onError(({ code, error, set }) => {
    // Log all errors
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as any).message === "string"
        ? (error as any).message
        : "";
    console.error(`[Elysia Error] ${code}:`, message);

    // Handle timeout errors
    if (message.includes("timeout")) {
      set.status = 504;
      return {
        error: "Request timeout",
        message:
          "O servidor demorou muito para responder. O banco de dados pode estar indisponível.",
        code: "TIMEOUT",
      };
    }

    // Handle database connection errors
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as any).message === "string" &&
      ((error as any).message.includes("CONNECT_TIMEOUT") ||
        (error as any).message.includes("connection"))
    ) {
      set.status = 503;
      return {
        error: "Database connection error",
        message:
          "Não foi possível conectar ao banco de dados. Tente novamente em alguns instantes.",
        code: "DB_CONNECTION_ERROR",
      };
    }

    // Default error
    set.status = 500;
    return {
      error: "Internal server error",
      message: message || "An unexpected error occurred",
      code: code || "UNKNOWN",
    };
  })
  .get("/", () => "Hello from MOMU Backend API")
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Backend is running",
  }))
  .use(workspacesRoutes)
  .use(filesRoutes)
  .use(fileRoutes)
  .use(trashRoutes)
  .listen({
    port: 3001,
    hostname: "0.0.0.0",
    // Bun-specific: ensure requests are handled properly
    reusePort: true,
  });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
