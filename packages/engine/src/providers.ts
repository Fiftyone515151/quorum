import type { ProviderName } from "./types.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ProviderEndpoint {
  apiKey: string;
  baseUrl: string;
}

function endpoint(provider: ProviderName): ProviderEndpoint {
  if (provider === "qwen") {
    return {
      apiKey: process.env.QWEN_API_KEY ?? "",
      baseUrl: process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    };
  }
  return {
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  };
}

/** Default model per provider for each role in the engine. */
export const MODELS = {
  qwen: { chat: "qwen-plus", fast: "qwen-turbo" },
  deepseek: { chat: "deepseek-chat", fast: "deepseek-chat" },
} as const;

export function defaultModel(provider: ProviderName): string {
  return MODELS[provider].chat;
}

export interface GenOptions {
  provider: ProviderName;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stream a chat completion token-by-token from an OpenAI-compatible endpoint.
 * Retries transient failures; if it ultimately fails, throws (per design: no
 * silent skip, no auto provider-switch).
 */
export async function* streamChat(opts: GenOptions): AsyncGenerator<string, void, unknown> {
  const { apiKey, baseUrl } = endpoint(opts.provider);
  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${opts.provider}". Set ${opts.provider === "qwen" ? "QWEN_API_KEY" : "DEEPSEEK_API_KEY"} in .env`
    );
  }

  const maxAttempts = 4;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.8,
          max_tokens: opts.maxTokens ?? 1500,
          stream: true,
        }),
        signal: opts.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`${opts.provider} ${opts.model} HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line || !line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) yield delta;
          } catch {
            // ignore keep-alive / partial fragments
          }
        }
      }
      return;
    } catch (err) {
      lastErr = err;
      if ((err as any)?.name === "AbortError") throw err;
      if (attempt < maxAttempts) await sleep(600 * attempt);
    }
  }
  throw new Error(
    `LLM call failed after ${maxAttempts} attempts (${opts.provider}/${opts.model}): ${String(lastErr)}`
  );
}

/** Collect a full (non-streamed) completion. */
export async function generateChat(opts: GenOptions): Promise<string> {
  let out = "";
  for await (const delta of streamChat(opts)) out += delta;
  return out.trim();
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`no JSON object found in: ${cleaned.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}

export interface StructuredOptions<T> {
  provider: ProviderName;
  model?: string;
  system: string;
  user: string;
  schema: { parse: (v: unknown) => T };
  temperature?: number;
  maxTokens?: number;
}

/**
 * Force a JSON completion and validate it with a zod schema. Retries a couple
 * times on parse/validation failure; throws if it still fails.
 */
export async function generateStructured<T>(opts: StructuredOptions<T>): Promise<T> {
  const model = opts.model ?? defaultModel(opts.provider);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const raw = await generateChat({
      provider: opts.provider,
      model,
      temperature: opts.temperature ?? 0.7,
      maxTokens: opts.maxTokens ?? 1200,
      messages: [
        { role: "system", content: opts.system },
        {
          role: "user",
          content: `${opts.user}\n\n只输出一个 JSON 对象，不要任何解释或代码块标记。`,
        },
      ],
    });
    try {
      return opts.schema.parse(extractJson(raw));
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`generateStructured failed after 3 attempts: ${String(lastErr)}`);
}
