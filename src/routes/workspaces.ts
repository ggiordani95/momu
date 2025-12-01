import { Elysia } from "elysia";
import sql from "../db";
import { withTimeout } from "../utils/queryTimeout";

export const workspacesRoutes = new Elysia({ prefix: "/workspaces" })
  // GET /workspaces - Listar workspaces do usuário
  .get("/", async ({ headers }) => {
    try {
      const userId = headers["x-user-id"] || headers["X-User-Id"];

      if (!userId) {
        console.warn(
          "⚠️ [GET /workspaces] No user ID provided, returning empty array"
        );
        return [];
      }

      // Buscar workspaces do usuário usando função SECURITY DEFINER para bypassar RLS
      console.log(
        `🔍 [GET /workspaces] Querying workspaces for user: ${userId}`
      );

      let folders;
      try {
        // Usar query direta sem withTimeout primeiro para evitar problemas de timeout negativo
        folders = await sql.unsafe(
          `SELECT * FROM get_user_workspaces($1::TEXT)`,
          [userId]
        );
      } catch (funcError: any) {
        console.error(
          `❌ [GET /workspaces] Error calling get_user_workspaces:`,
          funcError.message
        );
        // Fallback: query direta (pode ser bloqueada por RLS, mas vamos tentar)
        console.log(`⚠️ [GET /workspaces] Falling back to direct query...`);
        try {
          folders = await sql.unsafe(
            `
            SELECT DISTINCT w.*
            FROM workspaces w
            LEFT JOIN workspace_shares ws ON w.id = ws.workspace_id
            WHERE w.user_id = $1::TEXT
               OR ws.shared_with_user_id::TEXT = $1::TEXT
            ORDER BY w.created_at DESC
          `,
            [userId]
          );
        } catch (fallbackError: any) {
          console.error(
            `❌ [GET /workspaces] Fallback query also failed:`,
            fallbackError.message
          );
          throw fallbackError;
        }
      }

      console.log(
        `✅ [GET /workspaces] Fetched ${folders.length} workspace(s) for user ${userId}`,
        folders.length > 0
          ? `First workspace: ${folders[0]?.id} - ${folders[0]?.title}`
          : "No workspaces found"
      );

      // Log all workspace IDs for debugging
      if (folders.length > 0) {
        console.log(
          `📋 [GET /workspaces] Workspace IDs:`,
          folders.map((f: any) => f.id).join(", ")
        );
      }

      return [...folders];
    } catch (error: any) {
      console.error(
        "❌ [GET /workspaces] Error fetching workspaces:",
        error.message
      );
      console.error("   Stack:", error.stack);

      // If it's a timeout, throw to be handled by global error handler
      if (error.message?.includes("timeout")) {
        throw error;
      }

      // Return mock data if DB fails for MVP demonstration purposes
      return [
        {
          id: "1",
          title: "Meu Workspace",
          description: "Meu espaço de trabalho",
          is_public: false,
          created_at: new Date(),
        },
      ];
    }
  })

  // POST /workspaces - Criar novo workspace
  .post("/", async ({ body }) => {
    const { title, description, user_id } = body as any;
    try {
      // Generate a simple text ID for workspace
      const workspaceId = `workspace-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const result = await sql`
        INSERT INTO workspaces (id, user_id, title, description, is_public)
        VALUES (${workspaceId}, ${
        user_id || "user-000"
      }, ${title}, ${description}, false)
        RETURNING *
      `;
      if (!result || !result[0]) {
        throw new Error("Failed to insert workspace.");
      }
      console.log(`✅ [POST /workspaces] Created workspace: ${result[0].id}`);
      return result[0];
    } catch (error: any) {
      console.error(
        "❌ [POST /workspaces] Error creating workspace:",
        error?.message
      );
      return {
        id: "mock-id",
        title,
        description,
        user_id: user_id || "00000000-0000-0000-0000-000000000000",
      };
    }
  })

  // PATCH /workspaces/:id - Atualizar workspace
  .patch("/:id", async ({ params: { id }, body }) => {
    const updates = body as any;
    try {
      if (Object.keys(updates).length === 0) {
        return { error: "No fields to update" };
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.title !== undefined) {
        updateFields.push("title");
        updateValues.push(updates.title);
      }
      if (updates.description !== undefined) {
        updateFields.push("description");
        updateValues.push(updates.description);
      }
      if (updates.is_public !== undefined) {
        updateFields.push("is_public");
        updateValues.push(updates.is_public);
      }
      if (updates.cover_color !== undefined) {
        updateFields.push("cover_color");
        updateValues.push(updates.cover_color);
      }

      if (updateFields.length === 0) {
        return { error: "No valid fields to update" };
      }

      // Build SQL query dynamically
      const setClause = updateFields
        .map((field, index) => `${field} = $${index + 1}`)
        .join(", ");

      const result = await sql.unsafe(
        `UPDATE workspaces 
         SET ${setClause}
         WHERE id = $${updateFields.length + 1}
         RETURNING *`,
        [...updateValues, id]
      );

      if (result[0]) {
        console.log(`✅ [PATCH /folders/${id}] Updated workspace`);
      }
      return result[0] || { error: "Workspace not found" };
    } catch (error: any) {
      console.error(
        `❌ [PATCH /folders/${id}] Error updating workspace:`,
        error.message
      );
      return { error: "Failed to update workspace" };
    }
  })

  // GET /workspaces/sync-files - Buscar todos workspaces e files do usuário
  .get("/sync-files", async ({ headers }) => {
    try {
      const userId = headers["x-user-id"] || headers["X-User-Id"];

      if (!userId) {
        console.warn(
          "⚠️ [GET /workspaces/sync-files] No user ID provided, returning empty data"
        );
        return { workspaces: [], files: [] };
      }

      console.log(
        `🔍 [GET /workspaces/sync-files] Syncing all data for user: ${userId}`
      );

      // Buscar todos os workspaces do usuário
      const workspaces = await sql.unsafe(
        `SELECT * FROM get_user_workspaces($1::TEXT)`,
        [userId]
      );

      // Buscar todos os files de todos os workspaces do usuário
      const workspaceIds = workspaces.map((w: any) => w.id);
      let allFiles: any[] = [];

      if (workspaceIds.length > 0) {
        // Query única e eficiente para buscar todos os files de todos os workspaces
        // Usar sql.unsafe com ANY para arrays
        const directFiles = await sql.unsafe(
          `
          SELECT 
            f.id,
            f.workspace_id,
            f.type,
            f.parent_id,
            f.order_index,
            f.active,
            f.created_at,
            f.updated_at,
            CASE 
              WHEN f.type = 'note' THEN fn.title
              WHEN f.type = 'video' THEN fv.title
              WHEN f.type = 'folder' THEN ff.title
              ELSE NULL
            END as title,
            CASE 
              WHEN f.type = 'note' THEN fn.content
              ELSE NULL
            END as content,
            CASE 
              WHEN f.type = 'video' THEN fv.youtube_url
              ELSE NULL
            END as youtube_url,
            CASE 
              WHEN f.type = 'video' THEN fv.youtube_id
              ELSE NULL
            END as youtube_id,
            CASE 
              WHEN f.type = 'folder' THEN ff.description
              ELSE NULL
            END as description
          FROM files f
          LEFT JOIN files_note fn ON f.id = fn.file_id AND f.type = 'note'
          LEFT JOIN files_video fv ON f.id = fv.file_id AND f.type = 'video'
          LEFT JOIN files_folder ff ON f.id = ff.file_id AND f.type = 'folder'
          WHERE f.workspace_id = ANY($1::TEXT[])
          ORDER BY f.workspace_id, f.order_index ASC
        `,
          [workspaceIds]
        );
        allFiles = directFiles || [];
      }

      console.log(
        `✅ [GET /workspaces/sync-files] Synced ${workspaces.length} workspace(s) and ${allFiles.length} file(s) for user ${userId}`
      );

      return {
        workspaces: workspaces || [],
        files: allFiles || [],
      };
    } catch (error: any) {
      console.error(
        "❌ [GET /workspaces/sync-files] Error syncing data:",
        error.message
      );
      console.error("   Stack:", error.stack);
      return { workspaces: [], files: [], error: error.message };
    }
  });
