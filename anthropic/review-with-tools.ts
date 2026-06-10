import "dotenv/config";
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  REVIEW_SCHEMA,
  REVIEWER_PROMPT_STRUCTURED,
  type Review,
} from "../common/review-schema";
import { readDiff } from "./utils";

const REVIEW_JSON_SCHEMA = z.toJSONSchema(REVIEW_SCHEMA);

const NOISE = [
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
  /(^|\/)dist\//,
  /\.snap$/,
];

function pruneDiff(diff: string) {
  const files = diff.split(/(?=^diff --git )/m).filter(Boolean);
  const kept = files.filter((hunk) => {
    const path = hunk.match(/^diff --git a\/(\S+)/m)?.[1] ?? "";
    return !NOISE.some((re) => re.test(path));
  });
  return { prunedDiff: kept.join(""), dropped: files.length - kept.length };
}

async function review(diff: string): Promise<Review> {
  const reviewTools = createSdkMcpServer({
    name: "review-tools",
    version: "1.0.0",
    tools: [
      tool(
        "get_reviewable_diff",
        "Zwróć diff do recenzji z odsianym szumem (lockfile'y, build, snapshoty).",
        {},
        async () => {
          const { prunedDiff, dropped } = pruneDiff(diff);
          return {
            content: [
              { type: "text", text: `Odsiano ${dropped} plików.\n\n${prunedDiff}` },
            ],
          };
        },
      ),
    ],
  });

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
      mcpServers: { "review-tools": reviewTools },
      allowedTools: ["mcp__review-tools__get_reviewable_diff"],
      maxTurns: 4,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  });

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

const diff = await readDiff();
console.log(JSON.stringify(await review(diff), null, 2));
