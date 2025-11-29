import { Elysia } from "elysia";
import sql from "../db";

export const trashRoutes = new Elysia({ prefix: "/folders" })
  // GET /folders/:id/trash - Listar itens da lixeira de um workspace
  // Trash items são aqueles com active = false
  .get("/:id/trash", async ({ params: { id } }) => {
    try {
      // Usar função SECURITY DEFINER para bypassar RLS
      console.log(
        `🔍 [GET /folders/${id}/trash] Querying trash for workspace: ${id}`
      );
      const items = await sql.unsafe(
        `SELECT * FROM get_workspace_trash($1::TEXT)`,
        [id]
      );
      console.log(
        `✅ [GET /folders/${id}/trash] Fetched ${items.length} item(s) from trash`,
        items.length > 0
          ? `First item: ${items[0]?.id}`
          : "No trash items found"
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
