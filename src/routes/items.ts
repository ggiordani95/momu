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
      // Calculate the next order_index for this parent_id
      // Get the maximum order_index for items with the same parent_id in this workspace
      let maxOrderResult;
      if (parent_id) {
        // If parent_id is provided, find max order_index for items with this parent_id
        maxOrderResult = await sql`
          SELECT COALESCE(MAX(order_index), -1) as max_order
          FROM items
          WHERE workspace_id = ${id}
            AND parent_id = ${parent_id}
            AND deleted_at IS NULL
            AND (active IS NULL OR active = true)
        `;
      } else {
        // If parent_id is null, find max order_index for root items (parent_id IS NULL)
        maxOrderResult = await sql`
          SELECT COALESCE(MAX(order_index), -1) as max_order
          FROM items
          WHERE workspace_id = ${id}
            AND parent_id IS NULL
            AND deleted_at IS NULL
            AND (active IS NULL OR active = true)
        `;
      }

      const maxOrder = maxOrderResult[0]?.max_order ?? -1;
      const nextOrderIndex = maxOrder + 1;

      const result = await sql`
        INSERT INTO items (id, workspace_id, parent_id, type, title, content, youtube_url, youtube_id, order_index, active)
        VALUES (gen_random_uuid(), ${id}, ${parent_id || null}, ${type}, ${
        title || "Novo item"
      }, ${content || null}, ${youtube_url || null}, ${
        youtube_id || null
      }, ${nextOrderIndex}, ${(body as any)?.active ?? true})
        RETURNING *
      `;
      if (result[0]) {
        console.log(
          `✅ [POST /folders/${id}/items] Created item: ${result[0].id} (${result[0].type}: ${result[0].title}) with order_index: ${nextOrderIndex}`
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
  })
  // POST /folders/:id/sync - Sincronizar operações em batch
  .post("/:id/sync", async ({ params: { id }, body, headers }) => {
    const userId = headers["x-user-id"] || headers["X-User-Id"];
    const { operations } = body as any;

    console.log(
      `🔄 [POST /folders/${id}/sync] Syncing ${
        operations?.length || 0
      } operations for user: ${userId}`
    );

    // Validate user_id
    if (!userId) {
      console.error("❌ [POST /folders/${id}/sync] No user ID provided");
      return { error: "User ID is required" };
    }

    // Validate workspace belongs to user
    try {
      const workspace = await sql`
        SELECT id, user_id FROM folders WHERE id = ${id}
      `;
      if (!workspace || workspace.length === 0 || !workspace[0]) {
        console.error(`❌ [POST /folders/${id}/sync] Workspace not found`);
        return { error: "Workspace not found" };
      }
      if (workspace[0].user_id !== userId) {
        console.error(
          `❌ [POST /folders/${id}/sync] Workspace does not belong to user ${userId}`
        );
        return { error: "Workspace does not belong to user" };
      }
    } catch (error: any) {
      console.error(
        `❌ [POST /folders/${id}/sync] Error validating workspace:`,
        error.message
      );
      return { error: "Failed to validate workspace" };
    }

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return {
        success: true,
        synced: 0,
        failed: 0,
        results: [],
        errors: [],
      };
    }

    const results: any[] = [];
    const errors: string[] = [];
    let synced = 0;
    let failed = 0;

    // Mapa para rastrear IDs temporários -> IDs reais
    const tempIdMap = new Map<string, string>();

    // Ordenar operações: CREATEs primeiro (por timestamp), depois UPDATEs, DELETEs, UPDATE_ORDERs
    const sortedOps = [...operations].sort((a, b) => {
      const order = { CREATE: 0, UPDATE: 1, DELETE: 2, UPDATE_ORDER: 3 };
      const aOrder = order[a.type as keyof typeof order] ?? 999;
      const bOrder = order[b.type as keyof typeof order] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

    for (const op of sortedOps) {
      try {
        if (op.type === "CREATE") {
          // Resolver parent_id se for um ID temporário
          let parentId = op.data?.parent_id;
          if (parentId && parentId.startsWith("temp-")) {
            const realParentId = tempIdMap.get(parentId);
            if (realParentId) {
              parentId = realParentId;
            } else {
              parentId = null;
            }
          }

          // Extrair youtube_id de youtube_url se necessário
          let youtube_id = null;
          if (op.data?.youtube_url) {
            try {
              const url = new URL(op.data.youtube_url);
              if (url.hostname.includes("youtube.com")) {
                youtube_id = url.searchParams.get("v");
              } else if (url.hostname.includes("youtu.be")) {
                youtube_id = url.pathname.slice(1);
              }
            } catch (e) {}
          }

          // Calcular order_index
          let maxOrderResult;
          if (parentId) {
            maxOrderResult = await sql`
              SELECT COALESCE(MAX(order_index), -1) as max_order
              FROM items
              WHERE workspace_id = ${id}
                AND parent_id = ${parentId}
                AND deleted_at IS NULL
                AND (active IS NULL OR active = true)
            `;
          } else {
            maxOrderResult = await sql`
              SELECT COALESCE(MAX(order_index), -1) as max_order
              FROM items
              WHERE workspace_id = ${id}
                AND parent_id IS NULL
                AND deleted_at IS NULL
                AND (active IS NULL OR active = true)
            `;
          }

          const maxOrder = maxOrderResult[0]?.max_order ?? -1;
          const nextOrderIndex = op.data?.order_index ?? maxOrder + 1;

          const result = await sql`
            INSERT INTO items (id, workspace_id, parent_id, type, title, content, youtube_url, youtube_id, order_index, active)
            VALUES (gen_random_uuid(), ${id}, ${parentId || null}, ${
            op.data.type
          }, ${op.data.title || "Novo item"}, ${op.data.content || null}, ${
            op.data.youtube_url || null
          }, ${youtube_id || null}, ${nextOrderIndex}, ${
            op.data.active ?? true
          })
            RETURNING *
          `;

          if (result[0]) {
            // Mapear ID temporário para ID real
            tempIdMap.set(op.id, result[0].id);
            results.push({
              operationId: op.id,
              type: "CREATE",
              item: result[0],
            });
            synced++;
            console.log(
              `✅ [SYNC] Created item: ${result[0].id} (was ${op.id})`
            );
          }
        } else if (op.type === "UPDATE") {
          const itemId = tempIdMap.get(op.id) || op.id;
          const updateData: any = { [op.field]: op.value };

          // Se atualizando youtube_url, extrair youtube_id
          if (op.field === "youtube_url" && op.value) {
            try {
              const url = new URL(op.value);
              if (url.hostname.includes("youtube.com")) {
                updateData.youtube_id = url.searchParams.get("v");
              } else if (url.hostname.includes("youtu.be")) {
                updateData.youtube_id = url.pathname.slice(1);
              }
            } catch (e) {}
          }

          // Construir a query de UPDATE dinamicamente
          const updateFields: string[] = [];
          const values: any[] = [];
          let paramIndex = 1;

          if (updateData.title !== undefined) {
            updateFields.push(`title = $${paramIndex}`);
            values.push(updateData.title);
            paramIndex++;
          }
          if (updateData.content !== undefined) {
            updateFields.push(`content = $${paramIndex}`);
            values.push(updateData.content);
            paramIndex++;
          }
          if (updateData.youtube_url !== undefined) {
            updateFields.push(`youtube_url = $${paramIndex}`);
            values.push(updateData.youtube_url);
            paramIndex++;
          }
          if (updateData.youtube_id !== undefined) {
            updateFields.push(`youtube_id = $${paramIndex}`);
            values.push(updateData.youtube_id);
            paramIndex++;
          }

          const setClause = updateFields.join(", ");
          values.push(itemId);

          const result = await sql.unsafe(
            `UPDATE items 
             SET ${setClause}, updated_at = NOW()
             WHERE id = $${paramIndex}
             RETURNING *`,
            values
          );

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "UPDATE",
              item: result[0],
            });
            synced++;
            console.log(`✅ [SYNC] Updated item: ${itemId}`);
          }
        } else if (op.type === "DELETE") {
          const itemId = tempIdMap.get(op.id) || op.id;
          // Se o item ainda não foi criado (está apenas no localStorage), pular
          if (op.id.startsWith("temp-") && !tempIdMap.has(op.id)) {
            console.log(
              `⏭️ [SYNC] Skipping delete for non-existent item: ${op.id}`
            );
            continue;
          }

          const result = await sql`
            UPDATE items
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING id
          `;

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "DELETE",
              itemId: result[0].id,
            });
            synced++;
            console.log(`✅ [SYNC] Deleted item: ${itemId}`);
          }
        } else if (op.type === "UPDATE_ORDER") {
          const itemId = tempIdMap.get(op.id) || op.id;
          let parentId = op.data?.parent_id;
          if (parentId && parentId.startsWith("temp-")) {
            const realParentId = tempIdMap.get(parentId);
            if (realParentId) {
              parentId = realParentId;
            } else {
              parentId = null;
            }
          }

          const result = await sql`
            UPDATE items
            SET order_index = ${op.data.order_index}, parent_id = ${
            parentId || null
          }, updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING *
          `;

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "UPDATE_ORDER",
              item: result[0],
            });
            synced++;
            console.log(`✅ [SYNC] Updated order for item: ${itemId}`);
          }
        }
      } catch (error: any) {
        const errorMsg = error.message || "Unknown error";
        errors.push(`Failed to process ${op.type} ${op.id}: ${errorMsg}`);
        failed++;
        console.error(`❌ [SYNC] Failed to process operation:`, op, error);
      }
    }

    console.log(
      `✅ [POST /folders/${id}/sync] Sync completed: ${synced} synced, ${failed} failed`
    );

    return {
      success: failed === 0,
      synced,
      failed,
      results,
      errors,
      tempIdMap: Object.fromEntries(tempIdMap),
    };
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

// Rota de sincronização em batch (adicionada ao itemsRoutes, não ao itemRoutes)
export const syncRoutes = new Elysia({ prefix: "/folders" })
  // POST /folders/:id/sync - Sincronizar operações em batch
  .post("/:id/sync", async ({ params: { id }, body, headers }) => {
    const userId = headers["x-user-id"] || headers["X-User-Id"];
    const { operations } = body as any;

    console.log(
      `🔄 [POST /folders/${id}/sync] Syncing ${
        operations?.length || 0
      } operations for user: ${userId}`
    );

    // Validate user_id
    if (!userId) {
      console.error("❌ [POST /folders/${id}/sync] No user ID provided");
      return { error: "User ID is required" };
    }

    // Validate workspace belongs to user
    try {
      const workspace = await sql`
        SELECT id, user_id FROM folders WHERE id = ${id}
      `;
      if (!workspace || workspace.length === 0 || !workspace[0]) {
        console.error(`❌ [POST /folders/${id}/sync] Workspace not found`);
        return { error: "Workspace not found" };
      }
      if (workspace[0].user_id !== userId) {
        console.error(
          `❌ [POST /folders/${id}/sync] Workspace does not belong to user ${userId}`
        );
        return { error: "Workspace does not belong to user" };
      }
    } catch (error: any) {
      console.error(
        `❌ [POST /folders/${id}/sync] Error validating workspace:`,
        error.message
      );
      return { error: "Failed to validate workspace" };
    }

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return {
        success: true,
        synced: 0,
        failed: 0,
        results: [],
        errors: [],
      };
    }

    const results: any[] = [];
    const errors: string[] = [];
    let synced = 0;
    let failed = 0;

    // Mapa para rastrear IDs temporários -> IDs reais
    const tempIdMap = new Map<string, string>();

    // Ordenar operações: CREATEs primeiro (por timestamp), depois UPDATEs, DELETEs, UPDATE_ORDERs
    const sortedOps = [...operations].sort((a, b) => {
      const order = { CREATE: 0, UPDATE: 1, DELETE: 2, UPDATE_ORDER: 3 };
      const aOrder = order[a.type as keyof typeof order] ?? 999;
      const bOrder = order[b.type as keyof typeof order] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

    for (const op of sortedOps) {
      try {
        if (op.type === "CREATE") {
          // Resolver parent_id se for um ID temporário
          let parentId = op.data?.parent_id;
          if (parentId && parentId.startsWith("temp-")) {
            const realParentId = tempIdMap.get(parentId);
            if (realParentId) {
              parentId = realParentId;
            } else {
              parentId = null;
            }
          }

          // Extrair youtube_id de youtube_url se necessário
          let youtube_id = null;
          if (op.data?.youtube_url) {
            try {
              const url = new URL(op.data.youtube_url);
              if (url.hostname.includes("youtube.com")) {
                youtube_id = url.searchParams.get("v");
              } else if (url.hostname.includes("youtu.be")) {
                youtube_id = url.pathname.slice(1);
              }
            } catch (e) {}
          }

          // Calcular order_index
          let maxOrderResult;
          if (parentId) {
            maxOrderResult = await sql`
              SELECT COALESCE(MAX(order_index), -1) as max_order
              FROM items
              WHERE workspace_id = ${id}
                AND parent_id = ${parentId}
                AND deleted_at IS NULL
                AND (active IS NULL OR active = true)
            `;
          } else {
            maxOrderResult = await sql`
              SELECT COALESCE(MAX(order_index), -1) as max_order
              FROM items
              WHERE workspace_id = ${id}
                AND parent_id IS NULL
                AND deleted_at IS NULL
                AND (active IS NULL OR active = true)
            `;
          }

          const maxOrder = maxOrderResult[0]?.max_order ?? -1;
          const nextOrderIndex = op.data?.order_index ?? maxOrder + 1;

          const result = await sql`
            INSERT INTO items (id, workspace_id, parent_id, type, title, content, youtube_url, youtube_id, order_index, active)
            VALUES (gen_random_uuid(), ${id}, ${parentId || null}, ${
            op.data.type
          }, ${op.data.title || "Novo item"}, ${op.data.content || null}, ${
            op.data.youtube_url || null
          }, ${youtube_id || null}, ${nextOrderIndex}, ${
            op.data.active ?? true
          })
            RETURNING *
          `;

          if (result[0]) {
            // Mapear ID temporário para ID real
            tempIdMap.set(op.id, result[0].id);
            results.push({
              operationId: op.id,
              type: "CREATE",
              item: result[0],
            });
            synced++;
            console.log(
              `✅ [SYNC] Created item: ${result[0].id} (was ${op.id})`
            );
          }
        } else if (op.type === "UPDATE") {
          const itemId = tempIdMap.get(op.id) || op.id;
          const updateData: any = { [op.field]: op.value };

          // Se atualizando youtube_url, extrair youtube_id
          if (op.field === "youtube_url" && op.value) {
            try {
              const url = new URL(op.value);
              if (url.hostname.includes("youtube.com")) {
                updateData.youtube_id = url.searchParams.get("v");
              } else if (url.hostname.includes("youtu.be")) {
                updateData.youtube_id = url.pathname.slice(1);
              }
            } catch (e) {}
          }

          // Construir a query de UPDATE dinamicamente
          const updateFields: string[] = [];
          const values: any[] = [];
          let paramIndex = 1;

          if (updateData.title !== undefined) {
            updateFields.push(`title = $${paramIndex}`);
            values.push(updateData.title);
            paramIndex++;
          }
          if (updateData.content !== undefined) {
            updateFields.push(`content = $${paramIndex}`);
            values.push(updateData.content);
            paramIndex++;
          }
          if (updateData.youtube_url !== undefined) {
            updateFields.push(`youtube_url = $${paramIndex}`);
            values.push(updateData.youtube_url);
            paramIndex++;
          }
          if (updateData.youtube_id !== undefined) {
            updateFields.push(`youtube_id = $${paramIndex}`);
            values.push(updateData.youtube_id);
            paramIndex++;
          }

          const setClause = updateFields.join(", ");
          values.push(itemId);

          const result = await sql.unsafe(
            `UPDATE items 
             SET ${setClause}, updated_at = NOW()
             WHERE id = $${paramIndex}
             RETURNING *`,
            values
          );

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "UPDATE",
              item: result[0],
            });
            synced++;
            console.log(`✅ [SYNC] Updated item: ${itemId}`);
          }
        } else if (op.type === "DELETE") {
          const itemId = tempIdMap.get(op.id) || op.id;
          // Se o item ainda não foi criado (está apenas no localStorage), pular
          if (op.id.startsWith("temp-") && !tempIdMap.has(op.id)) {
            console.log(
              `⏭️ [SYNC] Skipping delete for non-existent item: ${op.id}`
            );
            continue;
          }

          const result = await sql`
            UPDATE items
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING id
          `;

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "DELETE",
              itemId: result[0].id,
            });
            synced++;
            console.log(`✅ [SYNC] Deleted item: ${itemId}`);
          }
        } else if (op.type === "UPDATE_ORDER") {
          const itemId = tempIdMap.get(op.id) || op.id;
          let parentId = op.parentId;
          if (parentId && parentId.startsWith("temp-")) {
            const realParentId = tempIdMap.get(parentId);
            if (realParentId) {
              parentId = realParentId;
            } else {
              parentId = null;
            }
          }

          const result = await sql`
            UPDATE items
            SET order_index = ${op.orderIndex}, parent_id = ${
            parentId || null
          }, updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING *
          `;

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "UPDATE_ORDER",
              item: result[0],
            });
            synced++;
            console.log(`✅ [SYNC] Updated order for item: ${itemId}`);
          }
        }
      } catch (error: any) {
        const errorMsg = error.message || "Unknown error";
        errors.push(`Failed to process ${op.type} ${op.id}: ${errorMsg}`);
        failed++;
        console.error(`❌ [SYNC] Failed to process operation:`, op, error);
      }
    }

    console.log(
      `✅ [POST /folders/${id}/sync] Sync completed: ${synced} synced, ${failed} failed`
    );

    return {
      success: failed === 0,
      synced,
      failed,
      results,
      errors,
      tempIdMap: Object.fromEntries(tempIdMap),
    };
  });
