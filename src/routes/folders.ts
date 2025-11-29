import { Elysia } from "elysia";
import sql from "../db";
import { withTimeout } from "../utils/queryTimeout";

export const foldersRoutes = new Elysia({ prefix: "/folders" })
  // GET /folders - Listar folders do usuário
  .get("/", async ({ headers }) => {
    try {
      const userId = headers["x-user-id"] || headers["X-User-Id"];

      if (!userId) {
        console.warn(
          "⚠️ [GET /folders] No user ID provided, returning empty array"
        );
        return [];
      }

      // Buscar workspaces do usuário usando função SECURITY DEFINER para bypassar RLS
      console.log(`🔍 [GET /folders] Querying workspaces for user: ${userId}`);

      let folders;
      try {
        folders = await withTimeout(
          sql.unsafe(`SELECT * FROM get_user_workspaces($1::TEXT)`, [userId]),
          30000 // 30 seconds timeout
        );
      } catch (funcError: any) {
        console.error(
          `❌ [GET /folders] Error calling get_user_workspaces:`,
          funcError.message
        );
        // Fallback: query direta (pode ser bloqueada por RLS, mas vamos tentar)
        console.log(`⚠️ [GET /folders] Falling back to direct query...`);
        folders = await withTimeout(
          sql.unsafe(
            `
            SELECT DISTINCT w.*
            FROM workspaces w
            LEFT JOIN workspace_shares ws ON w.id = ws.workspace_id
            WHERE w.user_id = $1::TEXT
               OR ws.shared_with_user_id::TEXT = $1::TEXT
            ORDER BY w.created_at DESC
          `,
            [userId]
          ),
          30000
        );
      }

      console.log(
        `✅ [GET /folders] Fetched ${folders.length} workspace(s) for user ${userId}`,
        folders.length > 0
          ? `First workspace: ${folders[0]?.id} - ${folders[0]?.title}`
          : "No workspaces found"
      );

      // Log all workspace IDs for debugging
      if (folders.length > 0) {
        console.log(
          `📋 [GET /folders] Workspace IDs:`,
          folders.map((f: any) => f.id).join(", ")
        );
      }

      return [...folders];
    } catch (error: any) {
      console.error("❌ [GET /folders] Error fetching folders:", error.message);
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

  // POST /folders - Criar novo workspace
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
      console.log(`✅ [POST /folders] Created workspace: ${result[0].id}`);
      return result[0];
    } catch (error: any) {
      console.error(
        "❌ [POST /folders] Error creating workspace:",
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

  // PATCH /folders/:id - Atualizar workspace
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
  });
