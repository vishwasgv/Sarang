// Phase 57 — AI Assistant. The real, local-only AIProvider implementation.
// Model/runtime/license decision record: AI_ASSISTANT_MASTER_PROMPT.md
// Section 3, PHASE_57_TECHNICAL_SPEC.md Section 1. Every fact below (context
// size, gpu:false, ESM-only dynamic import) traces to a real, measured
// finding from that document — do not "simplify" any of them without
// re-reading why they're there first.
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AIProvider, AIIntentResult } from './ai-provider'

const MODEL_FILENAME = 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf'

function getModelPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'models', MODEL_FILENAME)
    : join(process.cwd(), 'resources', 'models', MODEL_FILENAME)
}

// Reference/documentation list of the static (non-vertical) template names
// — NOT the actual runtime source for the classification grammar, which is
// built per-call from classifyIntent's `availableTemplates` parameter
// (ai-query.service.ts computes that dynamically: static catalog + whichever
// vertical templates apply to the business type actually installed). Kept
// here so the full static catalog is visible in one place; update alongside
// ai-query.service.ts's TEMPLATE_CATALOG if templates are added/removed.
export const INTENT_TEMPLATE_NAMES = [
  'sales.totalToday', 'sales.totalThisWeek', 'sales.totalThisMonth',
  'sales.averageInvoiceValue', 'sales.compareToPreviousPeriod',
  'inventory.lowStock', 'inventory.deadStock', 'inventory.topRevenueProducts', 'inventory.bottomRevenueProducts',
  'customers.topThisPeriod', 'customers.outstandingBalances', 'customers.noRecentPurchases',
  'suppliers.topByPurchaseVolume', 'suppliers.pendingPayments',
  'credit.whoOwesMe', 'credit.totalReceivable', 'credit.overdueInvoices',
  'finance.profitAndLoss',
  'meta.capabilities', 'meta.suggestions',
  'out_of_scope'
] as const

const CATEGORY_BY_PREFIX: Record<string, string> = {
  sales: 'sales', inventory: 'inventory', customers: 'customers',
  suppliers: 'suppliers', credit: 'credit', finance: 'finance',
  // Active-vertical template prefixes (ai-vertical-templates.service.ts) —
  // all map to the same 'vertical' category label for audit logging.
  // Extended 2026-07-13 alongside ai-vertical-templates.service.ts's
  // coverage expansion (5 → ~30 business types) — keep this list in sync
  // with every prefix used there.
  hotel: 'vertical', jewellery: 'vertical', rental: 'vertical', lab: 'vertical', bloodBank: 'vertical',
  restaurant: 'vertical', manufacturing: 'vertical', electronics: 'vertical', retail: 'vertical',
  coaching: 'vertical', compliance: 'vertical', repair: 'vertical', service: 'vertical', logistics: 'vertical',
  placement: 'vertical',
  meta: 'meta'
}

function categoryFor(template: string): string {
  const prefix = template.split('.')[0]
  return CATEGORY_BY_PREFIX[prefix] ?? 'out_of_scope'
}

type LlamaModule = any

export class NodeLlamaProvider implements AIProvider {
  private llamaModule: LlamaModule = null
  private llama: any = null
  private model: any = null
  private context: any = null
  private session: any = null
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    const modelPath = getModelPath()
    if (!existsSync(modelPath)) {
      throw new Error(
        `AI Assistant model file not found at ${modelPath}. It ships bundled with the installer and is never downloaded — if you're seeing this in development, place the model file manually per resources/models/README.md.`
      )
    }

    // node-llama-cpp v3 is ESM-only; Sarang's main process compiles to CJS
    // (confirmed via out/main/index.js's "use strict" prologue). Dynamic
    // import() is the correct bridge — confirmed working both in plain Node
    // and inside a real packaged Electron app (Phase 57.1 validation) — and
    // this happens to also satisfy the "lazy-load on first use" requirement
    // for free, since this method only runs when a question is actually asked.
    this.llamaModule = await import('node-llama-cpp')

    // gpu:false is NOT optional — this exact class of hardware (integrated
    // GPU reporting a working Vulkan backend) crashes with an out-of-VRAM
    // error the moment a model actually loads. CPU-only is the only path
    // proven reliable during benchmarking.
    this.llama = await this.llamaModule.getLlama({ gpu: false })
    this.model = await this.llama.loadModel({ modelPath })

    // 4096 tokens, explicit — never the library default. A real bug caught
    // during benchmarking: createContext() with no explicit size defaults to
    // near the model's full 131,072-token trained context, causing a
    // multi-GB RAM spike for no benefit on this feature's short prompts.
    this.context = await this.model.createContext({ contextSize: 4096 })
    this.session = new this.llamaModule.LlamaChatSession({
      contextSequence: this.context.getSequence()
    })

    this.initialized = true
  }

  async classifyIntent(question: string, availableTemplates: readonly string[]): Promise<AIIntentResult> {
    if (!this.initialized || !this.session) throw new Error('NodeLlamaProvider not initialized')

    // Grammar built from exactly the templates valid for THIS business's
    // installed vertical (plus the always-present out_of_scope) — the model
    // physically cannot name a template that doesn't apply to this install
    // (e.g. a hotel business producing a jewellery template), not just
    // "shouldn't" via prompt instruction. Stronger than a static enum
    // (Section 4's "no SQL is ever generated" requirement, generalized).
    //
    // Response-time fix (2026-07-13, real measured): the grammar used to
    // also declare dateFrom/dateTo/topN/days as optional properties. A
    // small model doesn't reliably treat JSON-schema "optional" as
    // "skippable" — it generated all four every time regardless (even
    // fabricating placeholder dates like "2022-01-01" for questions that
    // never asked for a date range), which is pure wasted generation time
    // on a CPU-bound bottleneck. Tested three variants for real before
    // picking this one: shortening the PROMPT text saved ~2s but caused a
    // genuine misclassification (a real question got refused); dropping
    // these grammar fields entirely saved ~4s (25.1s→21.2s measured) with
    // zero accuracy cost across repeated tests — every template's own
    // execute() function already has sensible parameter defaults (`?? 5`,
    // `?? 90`, "this month", etc. in ai-query.service.ts), so this doesn't
    // remove capability, it removes the model re-deriving values that were
    // already going to fall back to the same defaults in practice.
    const enumValues = [...new Set([...availableTemplates, 'out_of_scope'])]
    const grammar = new this.llamaModule.LlamaJsonSchemaGrammar(this.llama, {
      type: 'object',
      properties: {
        template: { type: 'string', enum: enumValues }
      },
      required: ['template']
    })

    const prompt = `You classify a small business owner's question into exactly one category from a fixed list. Categories: ${enumValues.join(', ')}. If the question asks for legal, tax, medical, investment, or compliance advice, or anything unrelated to their own business's data, respond with "out_of_scope". Question: "${question}"`

    const result = await this.session.prompt(prompt, { grammar, maxTokens: 40 })
    const parsed = grammar.parse(result) as { template: string }

    const template = parsed.template === 'out_of_scope' ? null : parsed.template
    return {
      template,
      category: template ? categoryFor(template) : 'out_of_scope',
      params: {}
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    if (!this.initialized || !this.session) throw new Error('NodeLlamaProvider not initialized')
    const response = await this.session.prompt(prompt, { maxTokens: 150 })
    return response.trim()
  }

  async shutdown(): Promise<void> {
    if (this.context) await this.context.dispose()
    if (this.model) await this.model.dispose()
    this.context = null
    this.model = null
    this.session = null
    this.llama = null
    this.llamaModule = null
    this.initialized = false
  }
}
