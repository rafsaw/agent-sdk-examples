import { ToolLoopAgent, Output, tool, stepCountIs } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import {
  REVIEW_SCHEMA,
  REVIEWER_PROMPT_STRUCTURED,
  type Review,
} from "../common/review-schema";
import { readDiff } from "./utils";

// Rola recenzenta (wspólna) trafia w ai-sdk do pola `instructions`.
// REVIEW_SCHEMA (zod) jest wspólny dla przykładów; Output.object składa z niego
// structured output. Zod nadal przyda się niżej do inputSchema narzędzia.

// Pliki, które w recenzji tylko zasłaniają sygnał: lockfile'y, build, snapshoty.
const NOISE = [
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
  /(^|\/)dist\//,
  /\.snap$/,
];

function pruneDiff(diff: string) {
  // każdy plik w unified diffie zaczyna się od nagłówka "diff --git a/… b/…"
  const files = diff.split(/(?=^diff --git )/m).filter(Boolean);
  const kept = files.filter((hunk) => {
    const path = hunk.match(/^diff --git a\/(\S+)/m)?.[1] ?? "";
    return !NOISE.some((re) => re.test(path));
  });
  return { prunedDiff: kept.join(""), dropped: files.length - kept.length };
}

// Proces review na podstawie git diffa — z własnym narzędziem przycinającym szum
async function review(diff: string): Promise<Review> {
  const reviewer = new ToolLoopAgent({
    model: openrouter("z-ai/glm-5.1"),
    instructions: `${REVIEWER_PROMPT_STRUCTURED}\n\nNajpierw pobierz diff przez getReviewableDiff, recenzuj wyłącznie to, co zwróci.`,
    tools: {
      // narzędzie z trzech części: opis, schemat wejścia (zod) i execute
      getReviewableDiff: tool({
        description:
          "Zwróć diff do recenzji z odsianym szumem (lockfile'y, build, snapshoty). Wywołaj przed recenzją.",
        inputSchema: z.object({}), // bez argumentów — diff bierze z domknięcia
        execute: async () => pruneDiff(diff),
      }),
    },
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(4), // wywołanie narzędzia + recenzja + structured output
  });

  const { output } = await reviewer.generate({
    prompt: "Zrecenzuj zmiany z bieżącego diffa.",
  });
  return output;
}

// Entry point całego procesu
const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
