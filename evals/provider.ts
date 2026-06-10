import { runReview } from "./review-agent";

// Custom provider promptfoo: opakowuje agenta AI SDK jako "model" w macierzy
// ewaluacji. Slug modelu OpenRouter pochodzi z `config.model` w
// promptfooconfig.yaml, więc jeden plik provider.ts obsługuje wszystkie modele.
//
// promptfoo kacze-typuje provider — wymaga tylko `id()` i `callApi()`, dlatego
// nie importujemy typów z pakietu `promptfoo` (uruchamiamy go przez `npx`).

interface ProviderOptions {
  id?: string;
  label?: string;
  config?: { model?: string };
}

interface ProviderResponse {
  output?: string;
  error?: string;
  tokenUsage?: { total?: number; prompt?: number; completion?: number };
  cost?: number;
}

export default class ReviewAgentProvider {
  private modelId: string;

  constructor(options: ProviderOptions) {
    this.modelId = options.config?.model ?? "z-ai/glm-5.1";
  }

  id(): string {
    return `aisdk:review:${this.modelId}`;
  }

  // promptfoo przekazuje wyrenderowany prompt (u nas: surowy diff) jako `prompt`.
  async callApi(prompt: string): Promise<ProviderResponse> {
    try {
      const { review, usage, cost } = await runReview(prompt, this.modelId);
      return {
        // Asercje (is-json / javascript) parsują tę odpowiedź z powrotem.
        output: JSON.stringify(review),
        tokenUsage: {
          total: usage.totalTokens,
          prompt: usage.inputTokens,
          completion: usage.outputTokens,
        },
        cost: cost ?? undefined,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
