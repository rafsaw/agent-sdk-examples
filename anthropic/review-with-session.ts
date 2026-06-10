import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { REVIEW_SCHEMA, REVIEWER_PROMPT, type Review } from "../common/review-schema";
import { readDiff } from "./utils";

const REVIEW_JSON_SCHEMA = z.toJSONSchema(REVIEW_SCHEMA);

const baseOptions = {
  systemPrompt: REVIEWER_PROMPT,
  model: "claude-sonnet-4-6",
  maxTurns: 2,
} as const;

async function firstPass(
  diff: string,
): Promise<{ sessionId: string; review: Review }> {
  let sessionId: string | undefined;
  let review: Review | undefined;

  for await (const message of query({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      ...baseOptions,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  })) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
    }
    if (message.type === "result") {
      if (message.subtype === "success") {
        review = message.structured_output as Review;
      } else {
        throw new Error(
          `Review nie powiodło się (${message.subtype}): ${message.errors.join("; ")}`,
        );
      }
    }
  }

  if (!sessionId) throw new Error("Nie złapano session_id z wiadomości init");
  if (!review) throw new Error("Agent nie zwrócił wyniku");
  return { sessionId, review };
}

async function secondPass(sessionId: string): Promise<string> {
  const result = query({
    prompt:
      "Bez ponownego wczytywania diffa: który plik recenzowałeś i które kryterium dostało najniższą ocenę? Odpowiedz krótko, zwykłym tekstem.",
    options: { ...baseOptions, resume: sessionId },
  });

  for await (const message of result) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") return message.result;
    throw new Error(`Druga tura nie powiodła się (${message.subtype})`);
  }
  throw new Error("Brak wyniku z drugiej tury");
}

const diff = await readDiff();

const { sessionId, review } = await firstPass(diff);
console.error(`\n[1] sesja: ${sessionId}`);
console.error("[1] recenzja:");
console.log(JSON.stringify(review, null, 2));

const recalled = await secondPass(sessionId);
console.error("\n[2] po wznowieniu sesji (bez ponownego diffa):");
console.log(recalled);
