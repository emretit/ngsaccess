"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { limiter } from "../lib/rateLimit";
import { authedAction } from "../lib/customFunctions";

const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

type OpenAiChatChoice = {
  message?: {
    content?: unknown;
  };
};

type OpenAiChatResponse = {
  choices?: unknown;
  error?: {
    message?: unknown;
  };
};

function asOpenAiChatResponse(value: unknown): OpenAiChatResponse {
  if (typeof value !== "object" || value === null) return {};
  return value as OpenAiChatResponse;
}

function extractChoiceContent(value: OpenAiChatResponse): string | null {
  if (!Array.isArray(value.choices)) return null;
  const first = value.choices[0] as OpenAiChatChoice | undefined;
  const content = first?.message?.content;
  return typeof content === "string" ? content : null;
}

function extractErrorMessage(value: OpenAiChatResponse): string | null {
  const message = value.error?.message;
  return typeof message === "string" ? message : null;
}

export const processMessage = authedAction({
  args: {
    input: v.string(),
    dbContext: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.object({
    content: v.string(),
    source: v.union(v.literal("openai"), v.literal("error")),
  }),
  handler: async (ctx, args) => {
    if (args.input.length > 4000) return { content: "Mesaj en fazla 4000 karakter olabilir. Lütfen mesajınızı kısaltın.", source: "error" as const };
    let projectId = args.projectId;
    const legacyClient = projectId === undefined;
    if (!projectId) {
      const projects = await ctx.runQuery(internal.users.listProjectIdsForCurrentUser, {});
      if (projects.length !== 1) {
        return { content: "Hangi proje için sorduğunuzu belirlemek üzere sayfayı yenileyin", source: "error" as const };
      }
      projectId = projects[0];
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        content: "OpenAI sunucu anahtarı yapılandırılmamış. Lütfen OPENAI_API_KEY env değerini ayarlayın.",
        source: "error" as const,
      };
    }

    const limit = await limiter.limit(ctx, "assistantMessage", { key: ctx.user._id });
    if (!limit.ok) return { content: "Saatlik 20 mesaj sınırına ulaştınız. Lütfen daha sonra yeniden deneyin.", source: "error" as const };
    // İstemci bağlamı güven sınırı değildir; güncel proje ayarıyla yeniden üret.
    const dbContext: string = await ctx.runQuery(internal.privacyRetention.getAssistantContext, { projectId, ...(legacyClient ? { forceMaskNames: true } : {}) });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(OPENAI_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "Sen NGSPlus PDKS asistanısın. Türkçe, kısa ve uygulanabilir yanıt ver. Kullanıcıya yalnız verilen PDKS bağlamına dayanarak cevap ver.\n\n" +
                dbContext,
            },
            { role: "user", content: args.input },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      const body = asOpenAiChatResponse(await response.json().catch(() => ({})));
      if (!response.ok) {
        return {
          content: extractErrorMessage(body) ?? `OpenAI API hatası: ${response.status}`,
          source: "error" as const,
        };
      }

      const content = extractChoiceContent(body);
      return {
        content: content ?? "OpenAI yanıtı okunamadı.",
        source: content ? ("openai" as const) : ("error" as const),
      };
    } catch (error: unknown) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "OpenAI isteği zaman aşımına uğradı."
          : error instanceof Error
            ? error.message
            : "OpenAI isteği tamamlanamadı.";
      return { content: message, source: "error" as const };
    } finally {
      clearTimeout(timeoutId);
    }
  },
});
