import { Elysia } from "elysia";
import sql from "../db";

// OpenRouter uses OpenAI-compatible API format
interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export const aiRoutes = new Elysia({ prefix: "/ai" })
  .post("/generate", async ({ body, set }) => {
    try {
      const { topic, workspaceId, userId } = body as {
        topic: string;
        workspaceId: string;
        userId: string;
      };

      if (!topic || !workspaceId || !userId) {
        set.status = 400;
        return {
          error: "Missing required fields",
          message: "topic, workspaceId, and userId are required",
        };
      }

      // Simple system prompt - just ask for content about the topic
      const systemPrompt = `Você é um assistente útil. Forneça conteúdo sobre o assunto solicitado e separe em tópicos importantes usando Markdown. Use emojis relevantes para tornar o conteúdo mais visual e atrativo. IMPORTANTE: Retorne APENAS texto em formato Markdown, NÃO retorne estruturas JSON, NÃO crie pastas ou arquivos, apenas forneça conteúdo textual formatado em Markdown.`;

      // User prompt with the specific topic
      const userPrompt = `Forneça conteúdo sobre: "${topic}". Separe em tópicos importantes usando Markdown (títulos, listas, parágrafos) e use emojis relevantes para ilustrar cada seção. Retorne APENAS texto Markdown, sem estruturas JSON ou referências a pastas/arquivos.`;

      // Use OpenRouter API
      const openRouterUrl =
        process.env.OPENROUTER_URL || "https://openrouter.ai/api/v1";
      const openRouterToken =
        process.env.OPENROUTER_API_KEY ||
        "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";
      const defaultModel = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

      console.log(`🤖 [AI] Calling OpenRouter with topic: "${topic}"`);
      console.log(`📦 [AI] Using model: ${defaultModel}`);

      // Use OpenRouter API (OpenAI-compatible)
      // Add timeout to prevent hanging requests (120 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 seconds timeout

      let response: Response;
      try {
        response = await fetch(`${openRouterUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterToken}`,
            "HTTP-Referer":
              process.env.OPENROUTER_REFERRER || "http://localhost:3000",
            "X-Title": "MOMU AI Assistant",
          },
          body: JSON.stringify({
            model: defaultModel,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
            temperature: 0.7,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          set.status = 504;
          return {
            error: "Request timeout",
            message:
              "A requisição demorou muito para responder. Tente novamente ou use um tópico mais simples.",
          };
        }
        throw error;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ [AI] OpenRouter API error:", errorText);

        // Check if it's a timeout error
        if (
          response.status === 524 ||
          response.status === 504 ||
          errorText.includes("timeout")
        ) {
          set.status = 504;
          return {
            error: "Request timeout",
            message:
              "A API demorou muito para responder. Tente novamente com um tópico mais simples ou aguarde alguns minutos.",
          };
        }

        set.status = response.status || 500;
        return {
          error: "AI service error",
          message: `Failed to generate content: ${errorText.substring(0, 500)}`, // Limit error message length
        };
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
        error?: {
          message?: string;
        };
      };

      console.log(`✅ [AI] Received response from OpenRouter`);

      // Extract content from OpenAI-compatible response format
      const aiContent = data.choices?.[0]?.message?.content || "";

      if (!aiContent) {
        console.error("❌ [AI] No content in response:", data);
        set.status = 500;
        return {
          error: "Invalid AI response",
          message: data.error?.message || "AI did not return any content.",
        };
      }

      // Log the raw AI response for debugging
      console.log(`📋 [AI] ========== RAW AI RESPONSE ==========`);
      console.log(aiContent);
      console.log(`📋 [AI] ========== END RAW RESPONSE ==========`);
      console.log(`📋 [AI] Response length: ${aiContent.length} characters`);

      // Check if response contains JSON structures that might be interpreted as folders
      if (
        aiContent.includes('"type"') &&
        (aiContent.includes('"folder"') || aiContent.includes('"note"'))
      ) {
        console.warn(
          `⚠️ [AI] Response contains JSON structure that might be interpreted as folders/files. This should be plain Markdown text only.`
        );
      }

      // Return the raw AI response without any processing or manipulation
      return {
        success: true,
        rawResponse: aiContent, // Raw content from AI - no processing
        fullResponse: data, // Complete OpenRouter response
        message: "AI response received",
      };
    } catch (error) {
      console.error("❌ [AI] Error generating content:", error);
      set.status = 500;
      return {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  })
  .get("/health", async () => {
    try {
      const openRouterUrl =
        process.env.OPENROUTER_URL || "https://openrouter.ai/api/v1";
      const openRouterToken =
        process.env.OPENROUTER_API_KEY ||
        "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";
      // Simple health check - try to access the API
      const response = await fetch(`${openRouterUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterToken}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 5,
        }),
      });

      if (!response.ok) {
        return {
          status: "unavailable",
          message: "OpenRouter service is not responding",
        };
      }

      return {
        status: "available",
        message: "OpenRouter service is running",
      };
    } catch (error) {
      return {
        status: "unavailable",
        message: "Cannot connect to OpenRouter service",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  })
  // GET /ai/chats - Get all chats for a user and workspace
  .get("/chats", async ({ query }) => {
    try {
      const { userId, workspaceId } = query as {
        userId?: string;
        workspaceId?: string;
      };

      if (!userId || !workspaceId) {
        return {
          error: "Missing required fields",
          message: "userId and workspaceId are required",
        };
      }

      console.log(
        `🔍 [GET /ai/chats] Fetching chats for user: ${userId}, workspace: ${workspaceId}`
      );

      const chats = await sql.unsafe(
        `SELECT * FROM get_user_ai_chats($1::TEXT, $2::TEXT)`,
        [userId, workspaceId]
      );

      console.log(
        `✅ [GET /ai/chats] Fetched ${chats.length} chat(s) from database`
      );

      return chats;
    } catch (error) {
      console.error("❌ [GET /ai/chats] Error:", error);
      return {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  })
  // POST /ai/chats - Create a new chat
  .post("/chats", async ({ body }) => {
    try {
      const { userId, workspaceId, title, messages } = body as {
        userId: string;
        workspaceId: string;
        title: string;
        messages: unknown[];
      };

      if (!userId || !workspaceId || !title) {
        return {
          error: "Missing required fields",
          message: "userId, workspaceId, and title are required",
        };
      }

      console.log(
        `📝 [POST /ai/chats] Creating chat for user: ${userId}, workspace: ${workspaceId}`
      );

      const chat = await sql`
        INSERT INTO ai_chats (user_id, workspace_id, title, messages)
        VALUES (${userId}, ${workspaceId}, ${title}, ${JSON.stringify(
        messages
      )}::jsonb)
        RETURNING *
      `;

      console.log(`✅ [POST /ai/chats] Created chat: ${chat[0]?.id}`);

      return chat[0];
    } catch (error) {
      console.error("❌ [POST /ai/chats] Error:", error);
      return {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  })
  // PUT /ai/chats/:id - Update a chat
  .put("/chats/:id", async ({ params, body }) => {
    try {
      const { id } = params;
      const { title, messages } = body as {
        title?: string;
        messages?: unknown[];
      };

      console.log(`📝 [PUT /ai/chats/${id}] Updating chat`);

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        values.push(title);
        paramIndex++;
      }

      if (messages !== undefined) {
        updates.push(`messages = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(messages));
        paramIndex++;
      }

      if (updates.length === 0) {
        return {
          error: "No updates provided",
          message: "At least one field (title or messages) must be provided",
        };
      }

      values.push(id);

      const chat = await sql.unsafe(
        `UPDATE ai_chats SET ${updates.join(
          ", "
        )} WHERE id = $${paramIndex} RETURNING *`,
        values as (string | number)[]
      );

      console.log(`✅ [PUT /ai/chats/${id}] Updated chat`);

      return chat[0];
    } catch (error) {
      console.error(`❌ [PUT /ai/chats/:id] Error:`, error);
      return {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  })
  // DELETE /ai/chats/:id - Delete a chat
  .delete("/chats/:id", async ({ params }) => {
    try {
      const { id } = params;

      console.log(`🗑️ [DELETE /ai/chats/${id}] Deleting chat`);

      await sql`DELETE FROM ai_chats WHERE id = ${id}`;

      console.log(`✅ [DELETE /ai/chats/${id}] Deleted chat`);

      return { success: true, message: "Chat deleted successfully" };
    } catch (error) {
      console.error(`❌ [DELETE /ai/chats/:id] Error:`, error);
      return {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });
