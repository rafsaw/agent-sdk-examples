import "dotenv/config";
import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  REVIEW_SCHEMA,
  REVIEWER_PROMPT,
  type Review,
} from "../common/review-schema";

// Samodzielny moduł agenta recenzenta — model jest wstrzykiwany z zewnątrz,
// dzięki czemu ten sam prompt (REVIEWER_PROMPT) i schemat (REVIEW_SCHEMA) można
// porównać na wielu modelach OpenRouter w macierzy ewaluacji promptfoo.
export function createReviewAgent(modelId: string): ToolLoopAgent {
  return new ToolLoopAgent({
    // usage.include = true → OpenRouter dokłada realny koszt w providerMetadata
    model: openrouter(modelId, { usage: { include: true } }),
    instructions: REVIEWER_PROMPT,
    tools: {},
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(2),
  });
}

export interface ReviewResult {
  review: Review;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  cost: number | null;
}

// Jedno przejście recenzji: bierze diff, zwraca ustrukturyzowaną ocenę wraz z
// zużyciem tokenów i kosztem (do raportowania w promptfoo).
export async function runReview(
  diff: string,
  modelId: string,
): Promise<ReviewResult> {
  const agent = createReviewAgent(modelId);
  const { output, totalUsage, providerMetadata } = await agent.generate({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
  });

  const orUsage = providerMetadata?.openrouter?.usage as
    | { cost?: number }
    | undefined;

  return {
    review: output,
    usage: {
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      totalTokens: totalUsage.totalTokens,
    },
    cost: orUsage?.cost ?? null,
  };
}
