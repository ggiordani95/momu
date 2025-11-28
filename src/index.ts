import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { itemsRoutes, itemRoutes } from "./routes/items";
import { trashRoutes } from "./routes/trash";
import { foldersRoutes } from "./routes/folders";

const app = new Elysia()
  .use(cors())
  .get("/", () => "Hello from MOMU Backend API")
  .use(foldersRoutes)
  .use(itemsRoutes)
  .use(itemRoutes)
  .use(trashRoutes)
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
