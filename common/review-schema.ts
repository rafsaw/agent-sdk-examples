import { z } from "zod";

export const REVIEWER_PROMPT = `Jesteś rygorystycznym recenzentem kodu.
Oceń podany diff w pięciu kryteriach w skali 1-5 (1 = poważne braki, 5 = wzorowo):
poprawność, bezpieczeństwo, wydajność, czytelność, pokrycie testami.
Zwróć wynik w postaci obiektu JSON z polami: correctness, security, performance, readability, testCoverage
(wszystkie liczby całkowite od 1 do 5) oraz comment (string z ogólnym komentarzem).`;

export const REVIEW_SCHEMA = z.object({
  correctness: z.number().int().min(1).max(5),
  security: z.number().int().min(1).max(5),
  performance: z.number().int().min(1).max(5),
  readability: z.number().int().min(1).max(5),
  testCoverage: z.number().int().min(1).max(5),
  comment: z.string(),
});

export const REVIEW_JSON_SCHEMA = z.toJSONSchema(REVIEW_SCHEMA, { target: "draft-07" });

export type Review = z.infer<typeof REVIEW_SCHEMA>;
