import { Elysia } from "elysia";
import sql from "../db";

export const itemsRoutes = new Elysia({ prefix: "/folders" })
  // GET /folders/:id/items - Listar itens de um workspace
  .get("/:id/items", async ({ params: { id } }) => {
    try {
      const items =
        await sql`SELECT * FROM items WHERE workspace_id = ${id} AND deleted_at IS NULL AND (active IS NULL OR active = true) ORDER BY order_index ASC`;
      console.log(
        `✅ [GET /folders/${id}/items] Fetched ${items.length} item(s) from database`
      );
      return [...items];
    } catch (error: any) {
      console.error(
        `❌ [GET /folders/${id}/items] Error fetching items:`,
        error.message
      );
      // Return mock items
      return [
        {
          id: "101",
          workspace_id: id,
          type: "section",
          title: "Módulo 1: Introdução",
          order_index: 0,
          active: true,
        },
        {
          id: "102",
          workspace_id: id,
          type: "video",
          title: "Aula 1: Notas Musicais",
          youtube_id: "dQw4w9WgXcQ",
          order_index: 1,
          active: true,
        },
        {
          id: "103",
          workspace_id: id,
          type: "task",
          title: "Praticar escala de Dó",
          order_index: 2,
          active: true,
        },
      ];
    }
  })

  // POST /folders/:id/items - Criar novo item
  .post("/:id/items", async ({ params: { id }, body, headers }) => {
    const { type, title, content, youtube_url, parent_id } = body as any;
    const userId = headers["x-user-id"] || headers["X-User-Id"];

    console.log(
      `📝 [POST /folders/${id}/items] Creating item for user: ${userId}`
    );
    console.log(`   Item data:`, { type, title, parent_id });

    // Validate user_id
    if (!userId) {
      console.error("❌ [POST /folders/${id}/items] No user ID provided");
      return { error: "User ID is required" };
    }

    // Validate workspace belongs to user
    try {
      const workspace = await sql`
          SELECT id, user_id FROM folders WHERE id = ${id}
        `;
      if (!workspace || workspace.length === 0 || !workspace[0]) {
        console.error(`❌ [POST /folders/${id}/items] Workspace not found`);
        return { error: "Workspace not found" };
      }
      if (workspace[0].user_id !== userId) {
        console.error(
          `❌ [POST /folders/${id}/items] Workspace does not belong to user ${userId}`
        );
        return { error: "Workspace does not belong to user" };
      }
      console.log(
        `✅ [POST /folders/${id}/items] Workspace validated for user ${userId}`
      );
    } catch (error: any) {
      console.error(
        `❌ [POST /folders/${id}/items] Error validating workspace:`,
        error.message
      );
      return { error: "Failed to validate workspace" };
    }

    let youtube_id = null;
    if (youtube_url) {
      try {
        const url = new URL(youtube_url);
        if (url.hostname.includes("youtube.com")) {
          youtube_id = url.searchParams.get("v");
        } else if (url.hostname.includes("youtu.be")) {
          youtube_id = url.pathname.slice(1);
        }
      } catch (e) {}
    }

    try {
      const result = await sql`
        INSERT INTO items (id, workspace_id, parent_id, type, title, content, youtube_url, youtube_id, order_index, active)
        VALUES (gen_random_uuid(), ${id}, ${parent_id || null}, ${type}, ${
        title || "Novo item"
      }, ${content || null}, ${youtube_url || null}, ${
        youtube_id || null
      }, 0, ${(body as any)?.active ?? true})
        RETURNING *
      `;
      if (result[0]) {
        console.log(
          `✅ [POST /folders/${id}/items] Created item: ${result[0].id} (${result[0].type}: ${result[0].title})`
        );
        return result[0];
      }
      throw new Error("Failed to create item");
    } catch (error: any) {
      console.error(
        `❌ [POST /folders/${id}/items] Error creating item:`,
        error.message
      );
      console.error("   Stack:", error.stack);
      return { error: `Failed to create item: ${error.message}` };
    }
  });

// Rotas de itens individuais (sem prefixo de workspace)
export const itemRoutes = new Elysia({ prefix: "/folders/items" })
  // PATCH /folders/items/:itemId - Atualizar item
  .patch("/:itemId", async ({ params: { itemId }, body }) => {
    const updates = body as any;
    try {
      if (Object.keys(updates).length === 0) {
        return { error: "No fields to update" };
      }

      // Handle youtube_url update - extract youtube_id if provided
      let youtube_id = updates.youtube_id;
      if (updates.youtube_url && !youtube_id) {
        try {
          const url = new URL(updates.youtube_url);
          if (url.hostname.includes("youtube.com")) {
            youtube_id = url.searchParams.get("v");
          } else if (url.hostname.includes("youtu.be")) {
            youtube_id = url.pathname.slice(1);
          }
        } catch (e) {
          // Invalid URL, keep existing youtube_id
        }
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.title !== undefined) {
        updateFields.push("title");
        updateValues.push(updates.title);
      }
      if (updates.content !== undefined) {
        updateFields.push("content");
        updateValues.push(updates.content);
      }
      if (updates.youtube_url !== undefined) {
        updateFields.push("youtube_url");
        updateValues.push(updates.youtube_url);
      }
      if (youtube_id !== undefined) {
        updateFields.push("youtube_id");
        updateValues.push(youtube_id);
      }
      if (updates.completed !== undefined) {
        updateFields.push("completed");
        updateValues.push(updates.completed);
        // Set completed_at if marking as completed
        if (updates.completed) {
          updateFields.push("completed_at");
          updateValues.push(new Date());
        } else {
          updateFields.push("completed_at");
          updateValues.push(null);
        }
      }
      if (updates.active !== undefined) {
        updateFields.push("active");
        updateValues.push(updates.active);
      }

      if (updateFields.length === 0) {
        return { error: "No valid fields to update" };
      }

      // Build SQL query dynamically
      const setClause = updateFields
        .map((field, index) => `${field} = $${index + 1}`)
        .join(", ");

      const result = await sql.unsafe(
        `UPDATE items 
         SET ${setClause}, updated_at = NOW()
         WHERE id = $${updateFields.length + 1}
         RETURNING *`,
        [...updateValues, itemId]
      );

      if (result[0]) {
        console.log(`✅ [PATCH /folders/items/${itemId}] Updated item`);
      }
      return result[0] || { error: "Item not found" };
    } catch (error: any) {
      console.error(
        `❌ [PATCH /folders/items/${itemId}] Error updating item:`,
        error.message
      );
      return { error: "Failed to update item" };
    }
  })

  // PATCH /folders/items/:itemId/order - Atualizar ordem do item
  .patch("/:itemId/order", async ({ params: { itemId }, body }) => {
    const { order_index, parent_id } = body as any;
    try {
      if (order_index === undefined && parent_id === undefined) {
        return { error: "No order_index or parent_id provided" };
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (order_index !== undefined) {
        updateFields.push("order_index");
        updateValues.push(order_index);
      }
      if (parent_id !== undefined) {
        updateFields.push("parent_id");
        updateValues.push(parent_id);
      }

      const setClause = updateFields
        .map((field, index) => `${field} = $${index + 1}`)
        .join(", ");

      const result = await sql.unsafe(
        `UPDATE items 
         SET ${setClause}, updated_at = NOW()
         WHERE id = $${updateFields.length + 1}
         RETURNING *`,
        [...updateValues, itemId]
      );

      if (result[0]) {
        console.log(
          `✅ [PATCH /folders/items/${itemId}/order] Updated item order`
        );
      }
      return result[0] || { error: "Item not found" };
    } catch (error: any) {
      console.error(
        `❌ [PATCH /folders/items/${itemId}/order] Error updating item order:`,
        error.message
      );
      return { error: "Failed to update item order" };
    }
  })

  // DELETE /folders/items/:itemId - Soft delete (mover para lixeira)
  .delete("/:itemId", async ({ params: { itemId } }) => {
    try {
      // Check if item exists
      const item = await sql`
        SELECT id FROM items WHERE id = ${itemId}
      `;

      if (item.length === 0) {
        return { error: "Item not found" };
      }

      // Soft delete - set deleted_at timestamp
      const result = await sql`
        UPDATE items 
        SET deleted_at = NOW()
        WHERE id = ${itemId}
        RETURNING id
      `;

      if (result.length === 0) {
        return { error: "Failed to delete item" };
      }

      console.log(`✅ [DELETE /folders/items/${itemId}] Moved item to trash`);
      return { success: true, id: itemId };
    } catch (error: any) {
      console.error(
        `❌ [DELETE /folders/items/${itemId}] Error deleting item:`,
        error.message
      );
      return { error: "Failed to delete item" };
    }
  })

  // POST /folders/items/:itemId/restore - Restaurar item da lixeira
  .post("/:itemId/restore", async ({ params: { itemId } }) => {
    try {
      const result = await sql`
        UPDATE items 
        SET deleted_at = NULL
        WHERE id = ${itemId}
        RETURNING *
      `;

      if (result.length === 0) {
        return { error: "Item not found" };
      }

      console.log(
        `✅ [POST /folders/items/${itemId}/restore] Restored item from trash`
      );
      return result[0];
    } catch (error: any) {
      console.error(
        `❌ [POST /folders/items/${itemId}/restore] Error restoring item:`,
        error.message
      );
      return { error: "Failed to restore item" };
    }
  })

  // DELETE /folders/items/:itemId/permanent - Deletar permanentemente
  .delete("/:itemId/permanent", async ({ params: { itemId } }) => {
    try {
      const result = await sql`
        DELETE FROM items WHERE id = ${itemId}
        RETURNING id
      `;

      if (result.length === 0) {
        return { error: "Item not found" };
      }

      console.log(
        `✅ [DELETE /folders/items/${itemId}/permanent] Permanently deleted item`
      );
      return { success: true, id: itemId };
    } catch (error: any) {
      console.error(
        `❌ [DELETE /folders/items/${itemId}/permanent] Error permanently deleting item:`,
        error.message
      );
      return { error: "Failed to delete item" };
    }
  });
