import "dotenv/config";
import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  REVIEWER_PROMPT,
  ReviewResult,
} from "../common/review-schema";

// Samodzielny moduł agenta recenzenta — model jest wstrzykiwany z zewnątrz,
// dzięki czemu ten sam prompt (REVIEWER_PROMPT) i schemat (ReviewResult) można
// porównać na wielu modelach OpenRouter w macierzy ewaluacji promptfoo.
export function createReviewAgent(modelId: string): ToolLoopAgent {
  return new ToolLoopAgent({
    // usage.include = true → OpenRouter dokłada realny koszt w providerMetadata
    model: openrouter(modelId, { usage: { include: true } }),
    instructions: REVIEWER_PROMPT,
    tools: {},
    output: Output.object({ schema: ReviewResult }),
    stopWhen: stepCountIs(2),
  });
}

// Wynik jednego przejścia recenzji: ustrukturyzowana ocena plus telemetria
// (zużycie tokenów i koszt) do raportowania w promptfoo.
export interface ReviewRun {
  review: ReviewResult;
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
): Promise<ReviewRun> {
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
