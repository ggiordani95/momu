import { Elysia } from "elysia";
import sql from "../db";

export const filesRoutes = new Elysia({ prefix: "/workspaces" })
  // GET /workspaces/:id/files - Listar arquivos de um workspace
  .get("/:id/files", async ({ params: { id } }) => {
    try {
      // Usar função SECURITY DEFINER para bypassar RLS
      console.log(
        `🔍 [GET /workspaces/${id}/files] Querying files for workspace: ${id}`
      );
      const files = await sql.unsafe(
        `SELECT * FROM get_workspace_files($1::TEXT)`,
        [id]
      );
      console.log(
        `✅ [GET /workspaces/${id}/files] Fetched ${files.length} file(s) from database`,
        files.length > 0 ? `First file: ${files[0]?.id}` : "No files found"
      );
      return [...files];
    } catch (error: any) {
      console.error(
        `❌ [GET /workspaces/${id}/files] Error fetching files:`,
        error.message
      );
      return [];
    }
  })

  // POST /workspaces/:id/files - Criar novo arquivo
  .post("/:id/files", async ({ params: { id }, body, headers }) => {
    const { type, title, content, youtube_url, parent_id } = body as any;
    const userId = headers["x-user-id"] || headers["X-User-Id"];

    console.log(
      `📝 [POST /workspaces/${id}/files] Creating file for user: ${userId}`
    );
    console.log(`   File data:`, { type, title, parent_id });

    // Validate user_id
    if (!userId) {
      console.error(`❌ [POST /workspaces/${id}/files] No user ID provided`);
      return { error: "User ID is required" };
    }

    // Validate workspace belongs to user
    try {
      const workspace = await sql`
          SELECT id, user_id FROM workspaces WHERE id = ${id}
        `;
      if (!workspace || workspace.length === 0 || !workspace[0]) {
        console.error(
          `❌ [POST /workspaces/${id}/files] Workspace not found. Workspace ID: ${id}, User ID: ${userId}`
        );
        console.warn(
          `⚠️ [POST /workspaces/${id}/files] Workspace not found, but allowing for development`
        );
      } else {
        if (workspace[0].user_id !== userId) {
          console.error(
            `❌ [POST /workspaces/${id}/files] Workspace does not belong to user. Workspace user_id: ${workspace[0].user_id}, Request user_id: ${userId}`
          );
          return { error: "Workspace does not belong to user" };
        }
        console.log(
          `✅ [POST /workspaces/${id}/files] Workspace validated for user ${userId}`
        );
      }
    } catch (error: any) {
      console.error(
        `❌ [POST /workspaces/${id}/files] Error validating workspace:`,
        error.message
      );
      if (
        !error.message?.includes("does not exist") &&
        !error.message?.includes("relation") &&
        !error.message?.includes("table")
      ) {
        return { error: `Failed to validate workspace: ${error.message}` };
      }
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
      let maxOrderResult;
      if (parent_id) {
        maxOrderResult = await sql`
          SELECT COALESCE(MAX(order_index), -1) as max_order
          FROM files
          WHERE workspace_id = ${id}
            AND parent_id = ${parent_id}
            AND active = true
        `;
      } else {
        maxOrderResult = await sql`
          SELECT COALESCE(MAX(order_index), -1) as max_order
          FROM files
          WHERE workspace_id = ${id}
            AND parent_id IS NULL
            AND active = true
        `;
      }

      const nextOrderIndex =
        maxOrderResult && maxOrderResult[0]
          ? maxOrderResult[0].max_order + 1
          : 0;

      // Generate file ID
      const fileId = `file-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Insert into files table
      await sql`
        INSERT INTO files (id, workspace_id, type, parent_id, order_index, active)
        VALUES (${fileId}, ${id}, ${type}::file_type, ${
        parent_id || null
      }, ${nextOrderIndex}, true)
      `;

      // Insert into specific table based on type
      if (type === "note") {
        await sql`
          INSERT INTO files_note (file_id, title, content)
          VALUES (${fileId}, ${title}, ${content || null})
        `;
      } else if (type === "video") {
        await sql`
          INSERT INTO files_video (file_id, title, youtube_url, youtube_id)
          VALUES (${fileId}, ${title}, ${youtube_url || null}, ${
          youtube_id || null
        })
        `;
      } else if (type === "folder") {
        await sql`
          INSERT INTO files_folder (file_id, title, description)
          VALUES (${fileId}, ${title}, ${null})
        `;
      }

      // Fetch the complete file data
      const result = await sql.unsafe(
        `SELECT * FROM get_workspace_files($1::TEXT) WHERE id = $2::TEXT`,
        [id, fileId]
      );

      console.log(`✅ [POST /workspaces/${id}/files] Created file: ${fileId}`);
      return result[0] || { id: fileId, type, title };
    } catch (error: any) {
      console.error(
        `❌ [POST /workspaces/${id}/files] Error creating file:`,
        error.message
      );
      return { error: `Failed to create file: ${error.message}` };
    }
  })

  // POST /workspaces/sync - Sincronizar operações em batch de todos os workspaces do usuário
  .post("/sync", async ({ body, headers }) => {
    const userId = headers["x-user-id"] || headers["X-User-Id"];
    const { operations } = body as any;

    console.log(
      `🔄 [POST /workspaces/sync] Syncing ${
        operations?.length || 0
      } operations for user: ${userId}`
    );

    // Validate user_id
    if (!userId) {
      console.error(`❌ [POST /workspaces/sync] No user ID provided`);
      return { error: "User ID is required" };
    }

    // Get all workspaces for the user
    let userWorkspaces: any[] = [];
    try {
      userWorkspaces = await sql.unsafe(
        `SELECT * FROM get_user_workspaces($1::TEXT)`,
        [userId]
      );
      console.log(
        `✅ [POST /workspaces/sync] Found ${userWorkspaces.length} workspace(s) for user ${userId}`
      );
    } catch (error: any) {
      console.error(
        `❌ [POST /workspaces/sync] Error fetching user workspaces:`,
        error.message
      );
      return { error: `Failed to fetch user workspaces: ${error.message}` };
    }

    // Create a map of workspace IDs for quick lookup
    const workspaceIds = new Set(userWorkspaces.map((w: any) => w.id));

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

          // Gerar file ID
          const newFileId = `file-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          // Get workspace ID from operation
          const workspaceId = op.workspaceId;

          // Validate workspace belongs to user
          if (!workspaceIds.has(workspaceId)) {
            console.warn(
              `⚠️ [SYNC] Skipping CREATE operation for workspace ${workspaceId} - not owned by user`
            );
            continue;
          }

          // Calcular order_index
          let maxOrderResult;
          if (parentId) {
            maxOrderResult = await sql`
              SELECT COALESCE(MAX(order_index), -1) as max_order
              FROM files
              WHERE workspace_id = ${workspaceId}
                AND parent_id = ${parentId}
                AND active = true
            `;
          } else {
            maxOrderResult = await sql`
              SELECT COALESCE(MAX(order_index), -1) as max_order
              FROM files
              WHERE workspace_id = ${workspaceId}
                AND parent_id IS NULL
                AND active = true
            `;
          }

          const maxOrder = maxOrderResult[0]?.max_order ?? -1;
          const nextOrderIndex = op.data?.order_index ?? maxOrder + 1;

          // Inserir na tabela files
          await sql`
            INSERT INTO files (id, workspace_id, type, parent_id, order_index, active)
            VALUES (${newFileId}, ${workspaceId}, ${op.data.type}::file_type, ${
            parentId || null
          }, ${nextOrderIndex}, ${op.data.active ?? true})
          `;

          // Inserir na tabela específica
          if (op.data.type === "note") {
            await sql`
              INSERT INTO files_note (file_id, title, content)
              VALUES (${newFileId}, ${op.data.title || "Nova nota"}, ${
              op.data.content || null
            })
            `;
          } else if (op.data.type === "video") {
            await sql`
              INSERT INTO files_video (file_id, title, youtube_url, youtube_id)
              VALUES (${newFileId}, ${op.data.title || "Novo vídeo"}, ${
              op.data.youtube_url || null
            }, ${youtube_id || null})
            `;
          } else if (op.data.type === "folder") {
            await sql`
              INSERT INTO files_folder (file_id, title, description)
              VALUES (${newFileId}, ${op.data.title || "Nova pasta"}, ${
              op.data.description || null
            })
            `;
          }

          // Buscar o arquivo completo para retornar
          const createdFile = await sql.unsafe(
            `SELECT * FROM get_workspace_files($1::TEXT) WHERE id = $2::TEXT`,
            [workspaceId, newFileId]
          );

          if (createdFile[0]) {
            // Mapear ID temporário para ID real
            tempIdMap.set(op.id, createdFile[0].id);
            results.push({
              operationId: op.id,
              type: "CREATE",
              item: createdFile[0],
            });
            synced++;
            console.log(
              `✅ [SYNC] Created file: ${createdFile[0].id} (was ${op.id})`
            );
          }
        } else if (op.type === "UPDATE") {
          const fileId = tempIdMap.get(op.id) || op.id;

          // Get workspace ID from file and validate
          const fileWorkspaceResult =
            await sql`SELECT workspace_id FROM files WHERE id = ${fileId}`;
          const fileWorkspaceId = fileWorkspaceResult[0]?.workspace_id;

          if (!fileWorkspaceId || !workspaceIds.has(fileWorkspaceId)) {
            console.warn(
              `⚠️ [SYNC] Skipping UPDATE operation for file ${fileId} - workspace not owned by user`
            );
            continue;
          }

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

          // Primeiro, atualizar a tabela base 'files' se os campos forem dela
          const fileUpdateFields: string[] = [];
          const fileUpdateValues: any[] = [];
          let fileParamIndex = 1;

          if (op.field === "parent_id") {
            fileUpdateFields.push(`parent_id = $${fileParamIndex}`);
            fileUpdateValues.push(op.value);
            fileParamIndex++;
          }
          if (op.field === "order_index") {
            fileUpdateFields.push(`order_index = $${fileParamIndex}`);
            fileUpdateValues.push(op.value);
            fileParamIndex++;
          }
          if (op.field === "active") {
            fileUpdateFields.push(`active = $${fileParamIndex}`);
            fileUpdateValues.push(op.value);
            fileParamIndex++;
          }

          if (fileUpdateFields.length > 0) {
            const setClause = fileUpdateFields.join(", ");
            await sql.unsafe(
              `UPDATE files 
               SET ${setClause}, updated_at = NOW()
               WHERE id = $${fileParamIndex}`,
              [...fileUpdateValues, fileId]
            );
          }

          // Depois, atualizar a tabela específica
          const fileTypeResult =
            await sql`SELECT type FROM files WHERE id = ${fileId}`;
          const fileType = fileTypeResult[0]?.type;

          if (fileType === "note") {
            const noteUpdateFields: string[] = [];
            const noteUpdateValues: any[] = [];
            let noteParamIndex = 1;

            if (op.field === "title") {
              noteUpdateFields.push(`title = $${noteParamIndex}`);
              noteUpdateValues.push(op.value);
              noteParamIndex++;
            }
            if (op.field === "content") {
              noteUpdateFields.push(`content = $${noteParamIndex}`);
              noteUpdateValues.push(op.value);
              noteParamIndex++;
            }

            if (noteUpdateFields.length > 0) {
              const setClause = noteUpdateFields.join(", ");
              await sql.unsafe(
                `UPDATE files_note 
                 SET ${setClause}, updated_at = NOW()
                 WHERE file_id = $${noteParamIndex}`,
                [...noteUpdateValues, fileId]
              );
            }
          } else if (fileType === "video") {
            const videoUpdateFields: string[] = [];
            const videoUpdateValues: any[] = [];
            let videoParamIndex = 1;

            if (op.field === "title") {
              videoUpdateFields.push(`title = $${videoParamIndex}`);
              videoUpdateValues.push(op.value);
              videoParamIndex++;
            }
            if (op.field === "youtube_url") {
              videoUpdateFields.push(`youtube_url = $${videoParamIndex}`);
              videoUpdateValues.push(op.value);
              videoParamIndex++;
            }
            if (updateData.youtube_id !== undefined) {
              videoUpdateFields.push(`youtube_id = $${videoParamIndex}`);
              videoUpdateValues.push(updateData.youtube_id);
              videoParamIndex++;
            }

            if (videoUpdateFields.length > 0) {
              const setClause = videoUpdateFields.join(", ");
              await sql.unsafe(
                `UPDATE files_video 
                 SET ${setClause}, updated_at = NOW()
                 WHERE file_id = $${videoParamIndex}`,
                [...videoUpdateValues, fileId]
              );
            }
          } else if (fileType === "folder") {
            const folderUpdateFields: string[] = [];
            const folderUpdateValues: any[] = [];
            let folderParamIndex = 1;

            if (op.field === "title") {
              folderUpdateFields.push(`title = $${folderParamIndex}`);
              folderUpdateValues.push(op.value);
              folderParamIndex++;
            }
            if (op.field === "description") {
              folderUpdateFields.push(`description = $${folderParamIndex}`);
              folderUpdateValues.push(op.value);
              folderParamIndex++;
            }

            if (folderUpdateFields.length > 0) {
              const setClause = folderUpdateFields.join(", ");
              await sql.unsafe(
                `UPDATE files_folder 
                 SET ${setClause}, updated_at = NOW()
                 WHERE file_id = $${folderParamIndex}`,
                [...folderUpdateValues, fileId]
              );
            }
          }

          // Buscar o arquivo completo para retornar
          const updatedFile = await sql.unsafe(
            `SELECT * FROM get_workspace_files($1::TEXT) WHERE id = $2::TEXT`,
            [fileWorkspaceId, fileId]
          );

          if (updatedFile[0]) {
            results.push({
              operationId: op.id,
              type: "UPDATE",
              item: updatedFile[0],
            });
            synced++;
            console.log(`✅ [SYNC] Updated file: ${fileId}`);
          }
        } else if (op.type === "DELETE") {
          const fileId = tempIdMap.get(op.id) || op.id;
          // Se o item ainda não foi criado (está apenas no localStorage), pular
          if (op.id.startsWith("temp-") && !tempIdMap.has(op.id)) {
            console.log(
              `⏭️ [SYNC] Skipping delete for non-existent file: ${op.id}`
            );
            continue;
          }

          // Get workspace ID from file and validate
          const fileWorkspaceResult =
            await sql`SELECT workspace_id FROM files WHERE id = ${fileId}`;
          const fileWorkspaceId = fileWorkspaceResult[0]?.workspace_id;

          if (!fileWorkspaceId || !workspaceIds.has(fileWorkspaceId)) {
            console.warn(
              `⚠️ [SYNC] Skipping DELETE operation for file ${fileId} - workspace not owned by user`
            );
            continue;
          }

          const result = await sql`
            UPDATE files
            SET active = false, updated_at = NOW()
            WHERE id = ${fileId}
            RETURNING id
          `;

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "DELETE",
              itemId: result[0].id,
            });
            synced++;
            console.log(`✅ [SYNC] Deleted file: ${fileId}`);
          }
        } else if (op.type === "UPDATE_ORDER") {
          const fileId = tempIdMap.get(op.id) || op.id;
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
            UPDATE files
            SET order_index = ${op.data.order_index}, parent_id = ${
            parentId || null
          }, updated_at = NOW()
            WHERE id = ${fileId}
            RETURNING *
          `;

          if (result[0]) {
            results.push({
              operationId: op.id,
              type: "UPDATE_ORDER",
              item: result[0],
            });
            synced++;
            console.log(`✅ [SYNC] Updated order for file: ${fileId}`);
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
      `✅ [POST /workspaces/sync] Sync completed: ${synced} synced, ${failed} failed`
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

export const fileRoutes = new Elysia({ prefix: "/files" })
  // GET /files/:id - Buscar um arquivo específico
  .get("/:id", async ({ params: { id } }) => {
    try {
      const result = await sql`
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
        WHERE f.id = ${id}
      `;

      if (!result || result.length === 0) {
        return { error: "File not found" };
      }

      return result[0];
    } catch (error: any) {
      console.error(
        `❌ [GET /files/${id}] Error fetching file:`,
        error.message
      );
      return { error: `Failed to fetch file: ${error.message}` };
    }
  })

  // PATCH /files/:id - Atualizar um arquivo
  .patch("/:id", async ({ params: { id }, body }) => {
    const updates = body as any;
    try {
      // Get file type first
      const fileResult = await sql`
        SELECT type FROM files WHERE id = ${id}
      `;

      if (!fileResult || fileResult.length === 0) {
        return { error: "File not found" };
      }

      const fileType = fileResult[0]?.type;

      // Update files table if needed
      if (
        updates.parent_id !== undefined ||
        updates.order_index !== undefined
      ) {
        const fileUpdates: any = {};
        if (updates.parent_id !== undefined)
          fileUpdates.parent_id = updates.parent_id;
        if (updates.order_index !== undefined)
          fileUpdates.order_index = updates.order_index;

        if (Object.keys(fileUpdates).length > 0) {
          await sql`
            UPDATE files
            SET ${sql(fileUpdates)}
            WHERE id = ${id}
          `;
        }
      }

      // Update specific table based on type
      if (fileType === "note") {
        const noteUpdates: any = {};
        if (updates.title !== undefined) noteUpdates.title = updates.title;
        if (updates.content !== undefined)
          noteUpdates.content = updates.content;

        if (Object.keys(noteUpdates).length > 0) {
          await sql`
            UPDATE files_note
            SET ${sql(noteUpdates)}
            WHERE file_id = ${id}
          `;
        }
      } else if (fileType === "video") {
        const videoUpdates: any = {};
        if (updates.title !== undefined) videoUpdates.title = updates.title;
        if (updates.youtube_url !== undefined)
          videoUpdates.youtube_url = updates.youtube_url;
        if (updates.youtube_id !== undefined)
          videoUpdates.youtube_id = updates.youtube_id;

        if (Object.keys(videoUpdates).length > 0) {
          await sql`
            UPDATE files_video
            SET ${sql(videoUpdates)}
            WHERE file_id = ${id}
          `;
        }
      } else if (fileType === "folder") {
        const folderUpdates: any = {};
        if (updates.title !== undefined) folderUpdates.title = updates.title;
        if (updates.description !== undefined)
          folderUpdates.description = updates.description;

        if (Object.keys(folderUpdates).length > 0) {
          await sql`
            UPDATE files_folder
            SET ${sql(folderUpdates)}
            WHERE file_id = ${id}
          `;
        }
      }

      // Fetch updated file
      const result = await sql`
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
        WHERE f.id = ${id}
      `;

      console.log(`✅ [PATCH /files/${id}] Updated file`);
      return result[0] || { error: "File not found" };
    } catch (error: any) {
      console.error(
        `❌ [PATCH /files/${id}] Error updating file:`,
        error.message
      );
      return { error: `Failed to update file: ${error.message}` };
    }
  })

  // DELETE /files/:id - Soft delete (marcar como active = false)
  .delete("/:id", async ({ params: { id } }) => {
    try {
      await sql`
        UPDATE files
        SET active = false
        WHERE id = ${id}
      `;

      console.log(`✅ [DELETE /files/${id}] Soft deleted file`);
      return { success: true };
    } catch (error: any) {
      console.error(
        `❌ [DELETE /files/${id}] Error deleting file:`,
        error.message
      );
      return { error: `Failed to delete file: ${error.message}` };
    }
  })

  // POST /files/:id/restore - Restaurar arquivo da lixeira
  .post("/:id/restore", async ({ params: { id } }) => {
    try {
      await sql`
        UPDATE files
        SET active = true
        WHERE id = ${id}
      `;

      console.log(`✅ [POST /files/${id}/restore] Restored file`);
      return { success: true };
    } catch (error: any) {
      console.error(
        `❌ [POST /files/${id}/restore] Error restoring file:`,
        error.message
      );
      return { error: `Failed to restore file: ${error.message}` };
    }
  });
