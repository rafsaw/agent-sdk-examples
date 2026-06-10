import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  REVIEW_SCHEMA,
  REVIEWER_PROMPT_STRUCTURED,
  type Review,
} from "../common/review-schema";
import { readDiff } from "./utils";

// Rola recenzenta (wspólna) — wąska i przewidywalna, bez dziedziczenia z repo.
// JSON Schema egzekwowany przez SDK na wyjściu modelu — z tego samego schematu
// zoda co przykłady ai-sdk, skonwertowanego jedną linijką.
const REVIEW_JSON_SCHEMA = z.toJSONSchema(REVIEW_SCHEMA);

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
  // to samo pruneDiff(diff) co wyżej — logika bez zmian, inny jest tylko montaż
  const reviewTools = createSdkMcpServer({
    name: "review-tools",
    version: "1.0.0",
    tools: [
      tool(
        "get_reviewable_diff",
        "Zwróć diff do recenzji z odsianym szumem (lockfile'y, build, snapshoty).",
        {}, // bez argumentów — diff bierzemy z domknięcia (inaczej: pola Zod)
        async () => {
          const { prunedDiff, dropped } = pruneDiff(diff);
          // narzędzie zwraca treść w formacie MCP, nie zwykły obiekt
          return {
            content: [
              { type: "text", text: `Odsiano ${dropped} plików.\n\n${prunedDiff}` },
            ],
          };
        },
      ),
    ],
  });

  // custom tool wymusza tryb streaming input: prompt to async generator, nie string
  async function* messages() {
    yield {
      type: "user" as const,
      parent_tool_use_id: null,
      message: {
        role: "user" as const,
        content:
          "Pobierz diff przez get_reviewable_diff i zrecenzuj wyłącznie to, co zwróci.",
      },
    };
  }

  const result = query({
    prompt: messages(),
    options: {
      systemPrompt: REVIEWER_PROMPT_STRUCTURED,
      model: "claude-sonnet-4-6",
      mcpServers: { "review-tools": reviewTools }, // narzędzie jako serwer MCP w procesie
      allowedTools: ["mcp__review-tools__get_reviewable_diff"], // jawnie dopuszczasz je po nazwie
      maxTurns: 4, // jak stepCountIs: zrób miejsce na turę narzędzia
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  });

  // Procesowanie odpowiedzi i ew. obsługa błędów
  for await (const message of result) {
    if (message.type !== "result") continue;
    if (message.subtype === "success") {
      return message.structured_output as Review;
    }
    throw new Error(
      `Review nie powiodło się (${message.subtype}): ${message.errors.join("; ")}`,
    );
  }
  throw new Error("Agent nie zwrócił wyniku");
}

// Entry point całego procesu
const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
