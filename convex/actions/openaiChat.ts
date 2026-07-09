"use node";

import { v } from "convex/values";
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

export const status = authedAction({
  args: {},
  returns: v.object({
    configured: v.boolean(),
  }),
  handler: async () => {
    return { configured: !!process.env.OPENAI_API_KEY };
  },
});

export const processMessage = authedAction({
  args: {
    input: v.string(),
    dbContext: v.string(),
  },
  returns: v.object({
    content: v.string(),
    source: v.union(v.literal("openai"), v.literal("error")),
  }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        content: "OpenAI sunucu anahtarı yapılandırılmamış. Lütfen OPENAI_API_KEY env değerini ayarlayın.",
        source: "error" as const,
      };
    }

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
                args.dbContext,
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
