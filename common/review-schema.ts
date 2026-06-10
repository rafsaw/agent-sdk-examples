import { z } from "zod";

// Wspólna rola recenzenta — jedno źródło prawdy dla system promptu / instrukcji.
// Wersja bazowa (bez wzmianki o structured output): używana tam, gdzie ten sam
// prompt obsługuje też przebieg zwykłym tekstem (np. wznowiona sesja).
export const REVIEWER_PROMPT = `Jesteś rygorystycznym recenzentem kodu.
Oceń podany diff w pięciu kryteriach w skali 1-5 (1 = poważne braki, 5 = wzorowo):
poprawność, bezpieczeństwo, wydajność, czytelność, pokrycie testami.
Dodaj krótki komentarz (2-3 zdania) wskazujący najważniejsze obserwacje.`;

// Wariant wymuszający ustrukturyzowany wynik — dla przebiegów, które kończą się
// emisją structured output zgodnego z REVIEW_SCHEMA.
export const REVIEWER_PROMPT_STRUCTURED = `${REVIEWER_PROMPT}
Zwróć wyłącznie ustrukturyzowany wynik zgodny ze schematem.`;

// Wspólny schemat recenzji — jedno źródło prawdy dla wszystkich przykładów.
// Pięć kryteriów (1-5) plus krótki komentarz.
//
// W przykładach ai-sdk używasz go wprost (Output.object oczekuje zoda).
// W przykładach anthropic SDK chce JSON Schema, więc konwertujesz go
// jedną linijką przez z.toJSONSchema(REVIEW_SCHEMA).
export const REVIEW_SCHEMA = z.object({
  correctness: z.number().int().min(1).max(5),
  security: z.number().int().min(1).max(5),
  performance: z.number().int().min(1).max(5),
  readability: z.number().int().min(1).max(5),
  testCoverage: z.number().int().min(1).max(5),
  comment: z.string(),
});

export type Review = z.infer<typeof REVIEW_SCHEMA>;
