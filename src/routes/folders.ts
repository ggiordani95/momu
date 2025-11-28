import { Elysia } from "elysia";
import sql from "../db";

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

      // Buscar folders do usuário ou compartilhados com ele
      const folders = await sql`
        SELECT DISTINCT w.*
        FROM folders w
        LEFT JOIN workspace_shares ws ON w.id = ws.workspace_id
        WHERE w.user_id = ${userId}
           OR ws.shared_with_user_id = ${userId}
        ORDER BY w.created_at DESC
      `;

      console.log(
        `✅ [GET /folders] Fetched ${folders.length} workspace(s) for user ${userId}`
      );
      return [...folders];
    } catch (error: any) {
      console.error("❌ [GET /folders] Error fetching folders:", error.message);
      console.error("   Stack:", error.stack);
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
      const result = await sql`
        INSERT INTO folders (id, user_id, title, description, is_public)
        VALUES (gen_random_uuid(), ${
          user_id || "00000000-0000-0000-0000-000000000000"
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
        `UPDATE folders 
         SET ${setClause}, updated_at = NOW()
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
