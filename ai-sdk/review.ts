import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  REVIEWER_PROMPT,
  ReviewResult,
} from "../common/review-schema";
import { readDiff } from "./utils";
import "dotenv/config";

// Modele OpenRouter do szybkiej podmiany:
// - openai/gpt-4.1-mini: tańsza alternatywa, zwykle dobrze trzyma JSON.
// - anthropic/claude-sonnet-4.5: mocniejsza alternatywa do structured output.
// - z-ai/glm-5.1: działał wcześniej, ale potrafi owijać JSON w markdown fences.
// - z-ai/glm-5.2: nowy model dodany przez RS
const REVIEW_MODEL = "z-ai/glm-5.2";

async function review(diff: string): Promise<ReviewResult> {
  const reviewer = new ToolLoopAgent({
    model: openrouter(REVIEW_MODEL, { usage: { include: true } }),
    instructions: REVIEWER_PROMPT,
    tools: {},
    output: Output.object({ schema: ReviewResult }),
    stopWhen: stepCountIs(2),
  });

  const { output, totalUsage, providerMetadata } = await reviewer.generate({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
    onStepFinish: ({ stepNumber, usage, finishReason }) => {
      console.error(`krok ${stepNumber}: ${usage.inputTokens} in / ${usage.outputTokens} out (${finishReason})`);
    },
  });

  const openrouterUsage = providerMetadata?.openrouter?.usage as
    | { cost?: number; totalTokens?: number }
    | undefined;

  console.error(
    `łącznie: ${totalUsage.inputTokens} in / ${totalUsage.outputTokens} out / ${totalUsage.totalTokens} total`,
  );
  console.error(`koszt OpenRouter: ${openrouterUsage?.cost ?? "brak danych od providera"} USD`);

  return output;
}

const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
