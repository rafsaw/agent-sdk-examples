import { z } from "zod";

export const REVIEWER_PROMPT = `Jesteś rygorystycznym recenzentem kodu.
Oceń podany diff w pięciu kryteriach w skali 1-5 (1 = poważne braki, 5 = wzorowo):
poprawność, bezpieczeństwo, wydajność, czytelność, pokrycie testami.
Dodaj krótki komentarz (2-3 zdania) wskazujący najważniejsze obserwacje.`;

export const REVIEWER_PROMPT_STRUCTURED = `${REVIEWER_PROMPT}
Zwróć wyłącznie ustrukturyzowany wynik zgodny ze schematem.`;

export const REVIEW_SCHEMA = z.object({
  correctness: z.number().int().min(1).max(5),
  security: z.number().int().min(1).max(5),
  performance: z.number().int().min(1).max(5),
  readability: z.number().int().min(1).max(5),
  testCoverage: z.number().int().min(1).max(5),
  comment: z.string(),
});

export type Review = z.infer<typeof REVIEW_SCHEMA>;
