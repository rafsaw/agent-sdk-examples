import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  REVIEW_SCHEMA,
  REVIEWER_PROMPT,
  type Review,
} from "../common/review-schema";
import { readDiff } from "./utils";

async function review(diff: string): Promise<Review> {
  const reviewer = new ToolLoopAgent({
    model: openrouter("z-ai/glm-5.1"),
    instructions: REVIEWER_PROMPT,
    tools: {},
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(2),
  });

  const { output } = await reviewer.generate({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
  });
  return output;
}

const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
