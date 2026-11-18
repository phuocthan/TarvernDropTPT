# Repository publishing

- The development repository is `phuocthan/TarvernDropTPT`.
- `phuocthan/DropTarvernRelease` is a separate, curated client delivery repository.
- Push to the release repository only when the user explicitly requests that destination. A request to push the main project does not authorize a release push.
- Each release push must contain only the milestone/files/features the user explicitly requested. Do not automatically synchronize later development changes or add unrequested deliverables.
- Preserve existing release history and milestone tags; use a new versioned tag for a new authorized delivery.
- Local profiling captures and downloaded provider application bundles under `output/load-audit/` are temporary diagnostics, outside the project deliverables.

# Framework naming

Use `fw-pixi` as the framework name in current source, documentation and filenames.

# Next-session context

Before continuing the latest client API work, read `docs/handoff-2026-11-19.md` and `docs/client-communication-log.md`. They record the newest client decisions, verified gaps and publishing restrictions.
