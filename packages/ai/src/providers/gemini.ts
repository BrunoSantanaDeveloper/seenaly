import { GoogleGenAI } from "@google/genai";

import type { AssistantConfig, ChatMessage, ChatProvider, StructuredOutput } from "../types";

function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [
      ...(message.attachments ?? []).map((attachment) => ({
        inlineData: { mimeType: attachment.mime, data: attachment.dataBase64 },
      })),
      { text: message.content || "(no text)" },
    ],
  }));
}

/**
 * Reserve room for the ANSWER.
 *
 * On Gemini 2.5 the reasoning tokens are billed against the SAME
 * `maxOutputTokens` budget as the reply, and they are not deterministic:
 * measured on gemini-2.5-flash with one identical readiness prompt, reasoning
 * ranged from 3.8k to 5.4k tokens across runs. With an 8k budget and a ~2k
 * answer that is a coin flip — and when it loses, the JSON stops mid-object and
 * the user sees a parse failure instead of a verdict.
 *
 * Capping reasoning at a third of the budget leaves two thirds for the answer,
 * which turns a random failure into a structural guarantee. Verified: the
 * capped runs still produce full 4–7 finding audits.
 *
 * Only Gemini 2.5+ accepts `thinkingConfig`; older models would reject it.
 */
function thinkingCap(config: AssistantConfig): { thinkingConfig?: { thinkingBudget: number } } {
  const isThinkingModel = /gemini-(2\.5|[3-9])/.test(config.model);
  if (!isThinkingModel || !config.maxTokens) return {};
  return { thinkingConfig: { thinkingBudget: Math.floor(config.maxTokens / 3) } };
}

export class GeminiProvider implements ChatProvider {
  readonly name = "gemini" as const;

  supportsAudio(): boolean {
    // Gemini models accept audio natively (inlineData).
    return true;
  }

  async *streamChat(config: AssistantConfig, messages: ChatMessage[]): AsyncGenerator<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const client = new GoogleGenAI({ apiKey: key });

    const contents = toGeminiContents(messages);

    const stream = await client.models.generateContentStream({
      model: config.model,
      contents,
      config: {
        systemInstruction: config.systemPrompt,
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }

  async generateStructured(
    config: AssistantConfig,
    messages: ChatMessage[],
    output: StructuredOutput,
  ): Promise<unknown> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const client = new GoogleGenAI({ apiKey: key });

    const response = await client.models.generateContent({
      model: config.model,
      contents: toGeminiContents(messages),
      config: {
        systemInstruction: config.systemPrompt,
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        responseMimeType: "application/json",
        // Raw JSON Schema (Gemini 2.5+); older models need the OpenAPI subset.
        responseJsonSchema: output.schema,
        ...thinkingCap(config),
      },
    });

    // A structured answer that got cut off is NOT malformed JSON — it is a
    // budget problem, and saying "invalid JSON" sends whoever debugs it looking
    // for a schema bug that does not exist. Measured on gemini-2.5-flash:
    // reasoning alone consumed 3.8k–5.4k tokens of the SAME budget across runs
    // of one identical prompt, so an 8k budget truncates the answer at random.
    if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      throw new Error(
        `Gemini hit the max_tokens limit (${config.maxTokens}) before finishing the answer. ` +
          `Raise max_tokens for this assistant.`,
      );
    }

    const text = response.text;
    if (!text) throw new Error("Gemini returned no structured output.");
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
    }
  }
}
