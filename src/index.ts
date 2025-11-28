import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import sql from "./db";

const app = new Elysia()
  .use(cors())
  .get("/", () => "Hello from DOMINA Backend")

  // --- TOPICS ---
  .get("/topics", async () => {
    try {
      const topics = await sql`SELECT * FROM topics ORDER BY created_at DESC`;
      console.log("Fetched topics:", topics.length);
      return [...topics];
    } catch (error) {
      console.error("Error fetching topics:", error);
      // Return mock data if DB fails for MVP demonstration purposes
      return [
        {
          id: "1",
          title: "Teclado Gospel 2026",
          description: "Aprenda teclado do zero",
          is_public: true,
          created_at: new Date(),
        },
        {
          id: "2",
          title: "Inglês Fluente",
          description: "Do zero ao avançado",
          is_public: true,
          created_at: new Date(),
        },
      ];
    }
  })
  .post("/topics", async ({ body }) => {
    const { title, description, user_id } = body as any;
    try {
      const result = await sql`
        INSERT INTO topics (id, user_id, title, description, is_public)
        VALUES (gen_random_uuid(), ${
          user_id || "00000000-0000-0000-0000-000000000000"
        }, ${title}, ${description}, false)
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error("Error creating topic:", error);
      return { id: "mock-id", title, description, user_id };
    }
  })

  // --- TOPIC ITEMS ---
  .get("/topics/:id/items", async ({ params: { id } }) => {
    try {
      const items =
        await sql`SELECT * FROM topic_items WHERE topic_id = ${id} ORDER BY order_index ASC`;
      return [...items];
    } catch (error) {
      console.error("Error fetching items:", error);
      // Return mock items
      return [
        {
          id: "101",
          topic_id: id,
          type: "section",
          title: "Módulo 1: Introdução",
          order_index: 0,
        },
        {
          id: "102",
          topic_id: id,
          type: "video",
          title: "Aula 1: Notas Musicais",
          youtube_id: "dQw4w9WgXcQ",
          order_index: 1,
        },
        {
          id: "103",
          topic_id: id,
          type: "task",
          title: "Praticar escala de Dó",
          order_index: 2,
        },
      ];
    }
  })
  .post("/topics/:id/items", async ({ params: { id }, body }) => {
    const { type, title, content, youtube_url, parent_id } = body as any;
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
        INSERT INTO topic_items (id, topic_id, parent_id, type, title, content, youtube_url, youtube_id, order_index)
        VALUES (gen_random_uuid(), ${id}, ${
        parent_id || null
      }, ${type}, ${title}, ${content}, ${youtube_url}, ${youtube_id}, 0)
        RETURNING *
      `;
      return result[0];
    } catch (error) {
      console.error("Error creating item:", error);
      // Generate unique ID for mock item using timestamp and random number
      const mockId = `mock-item-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      return {
        id: mockId,
        topic_id: id,
        type,
        title,
        content,
        youtube_id,
        parent_id: parent_id || null,
        order_index: 0,
      };
    }
  })

  // --- UPDATE ITEM ---
  .patch("/topics/items/:itemId", async ({ params: { itemId }, body }) => {
    const updates = body as any;
    try {
      // Build dynamic update query
      const fields = Object.keys(updates);
      const values = Object.values(updates);

      if (fields.length === 0) {
        return { error: "No fields to update" };
      }

      // Simple update for title and content
      if (updates.title !== undefined || updates.content !== undefined) {
        const result = await sql`
          UPDATE topic_items 
          SET 
            title = COALESCE(${updates.title}, title),
            content = COALESCE(${updates.content}, content),
            updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING *
        `;
        return result[0] || { error: "Item not found" };
      }

      return { error: "Invalid update fields" };
    } catch (error) {
      console.error("Error updating item:", error);
      return { error: "Failed to update item" };
    }
  })

  // --- UPDATE ITEM ORDER ---
  .patch(
    "/topics/items/:itemId/order",
    async ({ params: { itemId }, body }) => {
      const { order_index, parent_id } = body as any;
      try {
        if (order_index !== undefined && parent_id !== undefined) {
          const result = await sql`
            UPDATE topic_items 
            SET 
              order_index = ${order_index},
              parent_id = ${parent_id || null},
              updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING *
          `;
          return result[0] || { error: "Item not found" };
        } else if (order_index !== undefined) {
          const result = await sql`
            UPDATE topic_items 
            SET 
              order_index = ${order_index},
              updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING *
          `;
          return result[0] || { error: "Item not found" };
        } else if (parent_id !== undefined) {
          const result = await sql`
            UPDATE topic_items 
            SET 
              parent_id = ${parent_id || null},
              updated_at = NOW()
            WHERE id = ${itemId}
            RETURNING *
          `;
          return result[0] || { error: "Item not found" };
        }
        return { error: "No fields to update" };
      } catch (error) {
        console.error("Error updating item order:", error);
        return { error: "Failed to update item order" };
      }
    }
  )

  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
