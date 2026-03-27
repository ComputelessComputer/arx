---
alwaysApply: true
---

## Shared Reference

- Use `../philo/agents.md` as the shared working-style reference.
- Only apply instructions from that file when they fit this repository's tooling, scripts, and layout.
- Do not assume Philo-specific paths, release steps, or commands exist in Arx.

## Definition

- The app's name is Arx.

## General

- Prefer simple, maintainable, production-friendly solutions.
- Keep APIs small, behavior explicit, and naming clear.
- Avoid heavy abstractions, extra layers, or large dependencies for small features.
- By default, avoid comments. If a comment is needed, explain why rather than what.
- Keep changes small and reviewable.

## Validation

- Run the lightest relevant checks for the files you changed.
- For TypeScript changes, prefer `pnpm typecheck` and targeted tests when applicable.
