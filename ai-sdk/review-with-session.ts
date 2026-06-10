import { ToolLoopAgent, Output, stepCountIs, type ModelMessage } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { REVIEW_SCHEMA, REVIEWER_PROMPT_STRUCTURED } from "../common/review-schema";
import { readDiff } from "./utils";

// Rola recenzenta (wspólna) trafia w ai-sdk do pola `instructions`.
// REVIEW_SCHEMA (zod, wspólny dla przykładów) — z niego Output.object składa
// structured output w pierwszym przebiegu.

// W AI SDK `output` jest własnością agenta, nie pojedynczego wywołania — więc
// structured output (przebieg 1) i zwykły tekst (przebieg 2) to DWA osobne agenty.
// Łączy je ręcznie prowadzona historia `messages` (patrz niżej).
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

// Entry point: brak sesji — historię prowadzisz sam i podajesz przy każdym wywołaniu.
// To dokładnie ta różnica względem Claude Agent SDK: tam wznawiasz po `session_id`
// (diff zostaje po stronie harnessu), tu kontekst „pamięta się" tylko dlatego, że
// całe `messages` (z diffem włącznie) wieziesz ze sobą do kolejnego `generate()`.
const diff = await readDiff();
const messages: ModelMessage[] = [
  { role: "user", content: `Zrecenzuj ten diff:\n\n${diff}` },
];

// [1] Pierwszy przebieg: ustrukturyzowana recenzja
const first = await structuredReviewer.generate({ messages });
messages.push(...first.response.messages); // dopisz, co odpowiedział model
console.error("[1] recenzja:");
console.log(JSON.stringify(first.output, null, 2));

// [2] Drugi przebieg: kontynuacja = ty doniosłeś kontekst.
// Świadomie nie wklejamy diffa ponownie — jest już w `messages` z przebiegu [1].
messages.push({
  role: "user",
  content:
    "Bez ponownego wczytywania diffa: który plik recenzowałeś i które kryterium dostało najniższą ocenę? Odpowiedz krótko, zwykłym tekstem.",
});
const second = await recaller.generate({ messages });
console.error("\n[2] po doniesieniu historii (bez ponownego diffa):");
console.log(second.text);
