import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  REVIEW_JSON_SCHEMA,
  REVIEWER_PROMPT,
  type Review,
} from "../common/review-schema";
import { readDiff } from "./utils";

async function review(diff: string): Promise<Review> {
  const result = query({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    options: {
      systemPrompt: `${REVIEWER_PROMPT}`,
      model: "claude-sonnet-4-6",
      tools: [],
      maxTurns: 2,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  });

  for await (const message of result) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") {
      return message.structured_output as Review;
    }
    throw new Error(`Review nie powiodło się (${message.subtype}): ${message.errors.join("; ")}`);
  }
  throw new Error("Agent nie zwrócił wyniku");
}

const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
