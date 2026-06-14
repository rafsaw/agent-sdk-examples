import { ReviewResult } from "../../common/review-schema";

export default function assertSchema(output: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return { pass: false, score: 0, reason: "Wyjście nie jest poprawnym JSON-em" };
  }

  const result = ReviewResult.safeParse(parsed);
  if (result.success) {
    return { pass: true, score: 1, reason: "Zgodne ze schematem recenzji" };
  }
  return {
    pass: false,
    score: 0,
    reason: result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; "),
  };
}
