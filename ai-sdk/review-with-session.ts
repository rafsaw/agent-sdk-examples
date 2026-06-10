import "dotenv/config";
import { ToolLoopAgent, Output, stepCountIs, type ModelMessage } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { REVIEW_SCHEMA, REVIEWER_PROMPT_STRUCTURED } from "../common/review-schema";
import { readDiff } from "./utils";

const structuredReviewer = new ToolLoopAgent({
  model: openrouter("z-ai/glm-5.1"),
  instructions: REVIEWER_PROMPT_STRUCTURED,
  output: Output.object({ schema: REVIEW_SCHEMA }),
  stopWhen: stepCountIs(2),
});

const recaller = new ToolLoopAgent({
  model: openrouter("z-ai/glm-5.1"),
  instructions:
    "Jesteś tym samym recenzentem. Odpowiadaj zwięźle, zwykłym tekstem, korzystając z historii rozmowy.",
  stopWhen: stepCountIs(1),
});

const diff = await readDiff();
const messages: ModelMessage[] = [
  { role: "user", content: `Zrecenzuj ten diff:\n\n${diff}` },
];

const first = await structuredReviewer.generate({ messages });
messages.push(...first.response.messages);
console.error("[1] recenzja:");
console.log(JSON.stringify(first.output, null, 2));

messages.push({
  role: "user",
  content:
    "Bez ponownego wczytywania diffa: który plik recenzowałeś i które kryterium dostało najniższą ocenę? Odpowiedz krótko, zwykłym tekstem.",
});
const second = await recaller.generate({ messages });
console.error("\n[2] po doniesieniu historii (bez ponownego diffa):");
console.log(second.text);
