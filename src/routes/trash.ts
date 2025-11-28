import { Elysia } from "elysia";
import sql from "../db";

export const trashRoutes = new Elysia({ prefix: "/folders" })
  // GET /folders/:id/trash - Listar itens da lixeira de um workspace
  .get("/:id/trash", async ({ params: { id } }) => {
    try {
      const items =
        await sql`SELECT * FROM items WHERE workspace_id = ${id} AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
      console.log(
        `✅ [GET /folders/${id}/trash] Fetched ${items.length} item(s) from trash`
      );
      return [...items];
    } catch (error: any) {
      console.error(
        `❌ [GET /folders/${id}/trash] Error fetching trash items:`,
        error.message
      );
      return [];
    }
  });
