// Phase 57 — AI Assistant. AIProvider is the seam between the query pipeline
// (ai-query.service.ts) and whatever local LLM runtime actually answers a
// question. Every call site in the pipeline goes through this interface,
// never through node-llama-cpp's own API directly — this is what makes a
// future runtime swap a contained change instead of a rewrite (see
// AI_ASSISTANT_MASTER_PROMPT.md Section 3, PHASE_57_TECHNICAL_SPEC.md
// Section 6). FakeAIProvider below is the swap-test proof, not just a claim
// the abstraction holds.

export interface AIIntentResult {
  template: string | null // null means out_of_scope/no confident match
  category: string
  params: Record<string, unknown>
}

export interface AIProvider {
  initialize(): Promise<void>
  // availableTemplates is the full valid set for THIS classification call —
  // the static catalog plus whichever active-vertical templates apply to
  // the one business type actually installed (ai-vertical-templates.service.ts).
  // A real grammar-constrained implementation builds its output enum from
  // exactly this list, so the model can never even attempt to name a
  // template that doesn't apply to this business (e.g. a hotel install
  // classifying toward a jewellery template) — see
  // PHASE_57_TECHNICAL_SPEC.md Section 6.
  classifyIntent(question: string, availableTemplates: readonly string[]): Promise<AIIntentResult>
  generateResponse(prompt: string): Promise<string>
  shutdown(): Promise<void>
}

// Trivial test-double used in unit tests to prove the query pipeline never
// depends on node-llama-cpp's concrete API — only on this interface shape.
export class FakeAIProvider implements AIProvider {
  private initialized = false
  constructor(
    private readonly intentResponses: Record<string, AIIntentResult> = {},
    private readonly phrasingResponse: string = 'This is a fake phrased response.'
  ) {}

  async initialize(): Promise<void> {
    this.initialized = true
  }

  async classifyIntent(question: string, _availableTemplates: readonly string[]): Promise<AIIntentResult> {
    if (!this.initialized) throw new Error('FakeAIProvider not initialized')
    return this.intentResponses[question] ?? { template: null, category: 'out_of_scope', params: {} }
  }

  async generateResponse(_prompt: string): Promise<string> {
    if (!this.initialized) throw new Error('FakeAIProvider not initialized')
    return this.phrasingResponse
  }

  async shutdown(): Promise<void> {
    this.initialized = false
  }
}
