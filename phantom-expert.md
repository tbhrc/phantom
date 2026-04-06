# Phantom Expert Guide

## Purpose

This document is a working expert brief for the `phantom` repository. It is based on direct study of the codebase and current public project sources.

## What Phantom Actually Is

Phantom is not a thin chat wrapper. It is a persistent agent host built as a single Bun process that combines:

- an Anthropic Claude Agent SDK runtime
- multi-channel interaction surfaces
- a Qdrant/Ollama-backed memory system
- a self-evolution engine that rewrites prompt/config state over time
- an MCP server exposing both built-in and runtime-created tools
- a scheduler, secret collection flow, and shareable web UI

The central product idea is consistent everywhere in the repo: give the agent its own machine, let it keep state, let it build capabilities, and make those capabilities accessible across sessions and clients.

## The Core Mental Model

Phantom is best understood as six layers wired into one runtime:

1. `src/index.ts` is the composition root. It loads config, roles, DB, memory, evolution, MCP, channels, scheduler, onboarding, secrets, and the HTTP server.
2. `src/agent/runtime.ts` is the execution engine. It wraps `query()` from `@anthropic-ai/claude-agent-sdk`, resumes sessions, injects prompt layers, adds safety hooks, and streams runtime events.
3. `src/agent/prompt-assembler.ts` builds the real system prompt from identity, environment, security rules, role prompt, onboarding prompt, evolved config, working memory, and retrieved memory context.
4. `src/memory/*` gives Phantom continuity across conversations. It stores episodic, semantic, and procedural memory in Qdrant using Ollama embeddings.
5. `src/evolution/*` makes Phantom adaptive. After sessions, it extracts observations, critiques itself, proposes config deltas, validates them through five gates, applies approved changes, and versions the result.
6. `src/mcp/*` turns Phantom into infrastructure. It exposes status/config/history/memory/ask/task tools, role-specific tools, resources, and dynamic tools that persist in SQLite and are re-registered on boot.

That architecture is why Phantom feels more like a long-lived operator than a normal chatbot.

## Request Lifecycle

The main runtime path is:

1. A message enters through Slack, Telegram, Email, Webhook, or CLI.
2. `src/channels/router.ts` normalizes it.
3. `AgentRuntime.handleMessage()` opens or resumes a session.
4. The runtime wraps external user input with an inline security reminder.
5. `MemoryContextBuilder` retrieves facts, episodes, and relevant procedures.
6. `assemblePrompt()` builds the full prompt.
7. Claude Agent SDK `query()` runs with safety hooks and optional in-process MCP servers.
8. The response is sent back through the originating channel.
9. Memory consolidation runs asynchronously.
10. Evolution runs asynchronously.

This split is important: the user-facing reply path is synchronous enough to feel interactive, but memory and evolution are deliberately post-response side effects.

## The Most Important Subsystems

### 1. Agent Runtime

Key file: `src/agent/runtime.ts`

Important details:

- Uses persistent SDK sessions and retries without `resume` when a stale session is detected.
- Tracks active sessions to avoid concurrent processing on the same conversation key.
- Injects tool hooks:
  - `createDangerousCommandBlocker()`
  - `createFileTracker()`
- Can mount in-process MCP servers into the Claude SDK call, which is how scheduler, secrets, web UI, email, and dynamic tool management become available to the agent.

This is the practical heart of the system.

### 2. Prompt Assembly

Key file: `src/agent/prompt-assembler.ts`

Prompt assembly is a major part of Phantom’s design. The system prompt is layered, not monolithic:

- identity
- environment and platform capabilities
- hard security boundaries
- role prompt
- onboarding prompt
- evolved config from `phantom-config/`
- working instructions
- working-memory file
- retrieved memory context

This means Phantom’s behavior is driven less by code branching and more by controlled prompt composition plus post-session config mutation.

### 3. Memory

Key files:

- `src/memory/system.ts`
- `src/memory/context-builder.ts`
- `src/memory/episodic.ts`
- `src/memory/semantic.ts`
- `src/memory/procedural.ts`
- `docs/memory.md`

Memory is split into three stores:

- Episodic: prior sessions and outcomes
- Semantic: durable facts with contradiction handling
- Procedural: learned workflows

Retrieval is hybrid. Dense vectors come from Ollama embeddings, sparse matching comes from BM25-style search in Qdrant, and ranking uses Reciprocal Rank Fusion. The context builder budgets memory into the prompt, prioritizing facts first, then episodes, then procedures.

The system degrades gracefully: if Qdrant or Ollama is unavailable, Phantom still runs, just without persistent vector memory.

### 4. Self-Evolution

Key files:

- `src/evolution/engine.ts`
- `docs/self-evolution.md`
- `phantom-config/*`

This is the repo’s real differentiator.

After each session, Phantom:

1. extracts observations
2. builds a critique from them
3. generates targeted config deltas
4. validates through five gates
5. applies approved changes
6. periodically consolidates and prunes

The evolved state lives in `phantom-config/` rather than being buried in a database. That is a strong design choice: it makes the learned state inspectable, diffable, versioned, and rollback-able.

With `ANTHROPIC_API_KEY` present, judges can switch from heuristics to LLM-backed review. The code also tracks daily judge cost and falls back to heuristics when the cap is reached.

### 5. MCP Surface

Key files:

- `src/mcp/server.ts`
- `src/mcp/tools-universal.ts`
- `src/mcp/dynamic-tools.ts`
- `docs/mcp.md`

Phantom is both an agent and a server for other agents.

Built-in MCP tools cover:

- status
- evolved config
- metrics
- history
- memory query
- ask
- task create/status

Role-specific tools can be added by role ID. Dynamic tools are persisted in SQLite and reloaded on startup. This is one of the most important extensibility patterns in the repo.

### 6. Channels, Scheduling, and Secrets

Key files:

- `src/channels/*`
- `src/scheduler/service.ts`
- `src/secrets/tools.ts`
- `src/ui/serve.ts`

These modules make Phantom operational rather than purely conversational:

- Slack is the primary high-touch channel and has the deepest UX polish: reaction state machine, progress streaming, feedback buttons, onboarding.
- Scheduler jobs persist in SQLite and execute through the same runtime, which means scheduled tasks wake the full agent brain rather than a lightweight worker.
- Secret collection is handled through generated secure forms and magic links instead of asking users to paste credentials into chat.
- `/ui` serves authenticated pages, forms, and dashboards, which matters because the product promise includes shareable outputs, not just messages.

## Security Model

The security story is multi-layered and worth taking seriously because Phantom is intentionally powerful.

Important controls in the code and docs:

- MCP bearer token auth with scopes: `read`, `operator`, `admin`
- rate limiting and audit logging in `src/mcp/server.ts`
- dangerous command blocking hooks in `src/agent/hooks.ts`
- hard prompt-level prohibitions in `src/agent/prompt-assembler.ts`
- evolution constitution and safety gates in `src/evolution/*`
- encrypted secret storage and magic-link forms in `src/secrets/*`
- dynamic tool subprocess isolation and sanitized envs, documented in `docs/security.md`

One especially important architectural tradeoff: Phantom is designed to run on its own machine or VM, not on a personal workstation. The project explicitly embraces high capability and contains repeated warnings about Docker socket and machine-level trust boundaries.

## Repo Map By Responsibility

- `src/index.ts`: bootstrapping and subsystem wiring
- `src/agent/`: Claude SDK runtime, hooks, prompt assembly, sessions, cost tracking
- `src/channels/`: Slack, Telegram, Email, Webhook, CLI, progress and feedback UX
- `src/memory/`: vector memory stores, retrieval, consolidation, Qdrant/Ollama integration
- `src/evolution/`: reflection, validation, judges, versioning, config mutation
- `src/mcp/`: server, auth, resources, transport, dynamic tool registry
- `src/roles/` + `config/roles/`: role templates and loading
- `src/onboarding/`: first-run detection, owner profiling, injected onboarding prompt
- `src/secrets/`: encrypted secret collection and retrieval
- `src/ui/`: authenticated file serving, sessions, event stream, web tools
- `src/scheduler/`: recurring and one-shot job execution
- `src/db/`: Bun SQLite connection and migrations
- `phantom-config/`: mutable learned state
- `config/`: base declarative configuration
- `docs/`: project docs, architecture, memory, security, channels, deployment

## How To Reason About Changes

If you need to modify Phantom safely, use these heuristics:

- If behavior feels “personality driven,” inspect `prompt-assembler.ts`, role YAML, and `phantom-config/` before changing runtime code.
- If continuity is wrong, inspect memory extraction/consolidation and the context builder before touching prompt text.
- If post-session adaptation is wrong, start in `src/evolution/engine.ts`, then read reflection, validation, and application.
- If an external client cannot use a capability, inspect MCP auth/scope enforcement before the tool implementation.
- If the agent can do something interactively but not on a schedule, compare normal message flow to `Scheduler.executeJob()`.
- If a capability needs to persist across restarts, SQLite-backed registries and config files are the normal persistence points.

## Practical Expert Notes

- Phantom is intentionally YAML-first for roles and prompt configuration, but TypeScript-first for runtime behavior and enforcement.
- The system prefers inspectable persistence over hidden state. SQLite stores operational data; `phantom-config/` stores learned prompt state.
- A large amount of “product behavior” is implemented through runtime wiring and prompt composition rather than separate services.
- The codebase is small enough to understand end-to-end, but the critical joins are in `src/index.ts`. Read that file first when orienting.

## Current Public Context Verified Online

As of April 6, 2026:

- GitHub shows `ghostwright/phantom` as public with about `1.2k` stars and `142` forks.
- The visible latest tag is `v0.18.2`.
- Ghostwright’s site describes Phantom as an open-source/self-hosted or managed AI co-worker deployed to a dedicated machine, with self-evolution, MCP connectivity, encrypted credentials, and Slack-first onboarding.

Sources:

- https://github.com/ghostwright/phantom
- https://github.com/ghostwright/phantom/tags
- https://www.ghostwright.dev/phantom

## Local Verification Notes

I ran `bun test` in this checkout.

Observed result:

- 435 passing tests
- 44 failing tests
- 37 test-file errors

The dominant failure mode was missing runtime packages or environment-sensitive behavior, not a single coherent product regression. Examples included unresolved packages such as `yaml`, `zod`, `@slack/bolt`, and `@anthropic-ai/claude-agent-sdk`, plus a secrets test affected by `SECRET_ENCRYPTION_KEY` state. That suggests this working tree is not fully dependency-ready for a clean test pass in its current environment.

## Bottom Line

Phantom’s defining idea is not “Slack bot with memory.” It is “persistent autonomous operator on its own machine.” The repo implements that idea through a tightly integrated runtime:

- layered prompt assembly
- hybrid long-term memory
- post-session self-evolution
- MCP as first-class interface
- persistent dynamic tools
- secure credentials and shareable web outputs

If you understand `src/index.ts`, `src/agent/runtime.ts`, `src/agent/prompt-assembler.ts`, `src/memory/*`, `src/evolution/*`, and `src/mcp/*`, you understand the system at expert level.
