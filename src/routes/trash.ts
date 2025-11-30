import { Elysia } from "elysia";
import sql from "../db";

export const trashRoutes = new Elysia({ prefix: "/workspaces" })
  // GET /workspaces/:id/trash - Listar arquivos da lixeira de um workspace
  // Trash files são aqueles com active = false
  .get("/:id/trash", async ({ params: { id } }) => {
    try {
      // Usar função SECURITY DEFINER para bypassar RLS
      console.log(
        `🔍 [GET /workspaces/${id}/trash] Querying trash for workspace: ${id}`
      );
      const files = await sql.unsafe(
        `SELECT * FROM get_workspace_trash_files($1::TEXT)`,
        [id]
      );
      console.log(
        `✅ [GET /workspaces/${id}/trash] Fetched ${files.length} file(s) from trash`,
        files.length > 0
          ? `First file: ${files[0]?.id}`
          : "No trash files found"
      );
      return [...files];
    } catch (error: any) {
      console.error(
        `❌ [GET /workspaces/${id}/trash] Error fetching trash files:`,
        error.message
      );
      return [];
    }
  });
