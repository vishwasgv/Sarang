# AI Assistant model file

This directory holds the bundled local LLM model for Sarang's AI Assistant
feature (Phase 57). The `.gguf` model file is not tracked in git — it's a
~941MB downloadable build asset, not source code (see `.gitignore`).

## Required file

`Qwen2.5-1.5B-Instruct-Q4_K_M.gguf` — download from:
https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf

Place it directly in this directory before running a real installer build
(`npm run dist`). It is not required for `npm run dev` unless you're actively
testing the AI Assistant feature — the module is opt-in and off by default,
so its absence doesn't affect any other part of the app.

## Why this model

See `AI_ASSISTANT_MASTER_PROMPT.md` (parent directory of the repo) and
`PHASE_57_TECHNICAL_SPEC.md` for the full model/license/benchmark decision
record. Short version: Apache 2.0 licensed, chosen after a real (not
estimated) benchmark on representative 8GB-RAM-class hardware rejected the
original larger model pin for using too much RAM and running too slowly.
