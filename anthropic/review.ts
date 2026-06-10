import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  REVIEW_SCHEMA,
  REVIEWER_PROMPT_STRUCTURED,
  type Review,
} from "../common/review-schema";
import { readDiff } from "./utils";

// Rola recenzenta (wspólna) — wąska i przewidywalna, bez dziedziczenia z repo.
// JSON Schema egzekwowany przez SDK na wyjściu modelu — powstaje z tego samego
// schematu zoda co przykłady ai-sdk, skonwertowanego jedną linijką.
const REVIEW_JSON_SCHEMA = z.toJSONSchema(REVIEW_SCHEMA);

// Proces review na podstawie git diffa
async function review(diff: string): Promise<Review> {

  // Konfiguracja agenta
  const result = query({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      systemPrompt: REVIEWER_PROMPT_STRUCTURED,
      model: "claude-sonnet-4-6",
      tools: [],
      maxTurns: 2,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  });

  // Procesowanie odpowiedzi i ew. obsługa błędów
  for await (const message of result) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") {
      return message.structured_output as Review;
    }
    throw new Error(`Review nie powiodło się (${message.subtype}): ${message.errors.join("; ")}`);
  }
  throw new Error("Agent nie zwrócił wyniku");
}

// Entry point całego procesu
const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
