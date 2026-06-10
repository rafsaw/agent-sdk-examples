import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  REVIEW_SCHEMA,
  REVIEWER_PROMPT_STRUCTURED,
  type Review,
} from "../common/review-schema";
import { readDiff } from "./utils";

// Rola recenzenta (wspólna) trafia w ai-sdk do pola `instructions`.
// REVIEW_SCHEMA to zwykły schemat zoda (wspólny dla przykładów) — Output.object
// składa z niego structured output. W ai-sdk podajesz zoda wprost, bez konwersji.

// Proces review na podstawie git diffa
async function review(diff: string): Promise<Review> {
  // Wykorzystanie tzw. pętli agentowej z AI SDK 6
  const reviewer = new ToolLoopAgent({
    model: openrouter("z-ai/glm-5.1"), // model importujesz jawnie — podmiana dostawcy to jedna linijka
    instructions: REVIEWER_PROMPT_STRUCTURED,
    tools: {}, // na ten moment bez niestandardowych narzędzi
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(2), // odpowiednik maxTurns: recenzja + emisja structured output
  });

  const { output } = await reviewer.generate({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
  });
  return output;
}

// Entry point całego procesu
const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
