# Client milestone exports

Development continues in `phuocthan/TarvernDropTPT`. The client reviews published snapshots in [phuocthan/DropTarvernRelease](https://github.com/phuocthan/DropTarvernRelease). Its `main` branch holds the latest review candidate and milestone tags preserve earlier delivery points. Each snapshot records the source implementation commit in `SOURCE_REVISION`.

## User-controlled publishing policy

Push development changes to `TarvernDropTPT` when requested. Push `DropTarvernRelease` only when the user explicitly names that release destination, and include only the milestone/files/features they specify. A development push must never automatically trigger a release export, commit or push. The user reaffirmed this policy on 18 November 2026. Existing milestone tags must remain unchanged.

## Working flow — reaffirmed 20 November 2026

Develop and verify in `TarvernDropTPT` → curate the requested milestone scope in `DropTarvernRelease` → submit the approved client scope on the client's feature branch through a Draft GitLab MR.

Both downstream destinations require an explicit user instruction: **do not push release or client GitLab, or publish/update the client MR, merely because development, local tests or milestone packaging is complete**. Preserve protected main and the approved branch base. An instruction to pull code or run locally does not authorize publication.

## Milestone 1 package

The explicit file list is in [export-milestone-1.ps1](../release/export-milestone-1.ps1). It includes the shared TypeScript/PixiJS core, Tavern 5 × 5 JSON and 3 × 3 reuse configuration, durable synthetic v1 mock API, 22 sanitized request/response examples, shared tests and production browser smoke, a package lock and build configuration, the client README and M1 documents, and clean-preview desktop/portrait screenshots. The release entry points mount both configurations using the shared placeholder skin.

The development checkout retains the original reference art, fonts, audio, Spine files, asset viewer, research captures, technical notes, local runtime files, Railway configuration and development Git history. The public preview is built from a clean Git archive of a named commit. The exporter replaces the entry/catalog, strips reference loading/resources from the public config, and records file hashes in `EXPORT_MANIFEST.json`. Natural feature triggers are disabled only in the placeholder preview catalog; feature behavior is validated through backend/transport tests and API examples.

## Export and review

1. Commit the development source and resolve the commit ID.
2. Run `pwsh -File release/export-milestone-1.ps1 -Destination <empty-folder-outside-repo> -Revision <development-commit>`.
3. Verify the exported file list, run `npm ci`, `npm run build`, `npm test` and smoke-test both routes using `npm start`.
4. Commit the resulting files to the client repository. For future exports, use that repository's existing history. Push its delivery branch and a new versioned milestone tag after verification. Never rewrite the original `milestone-1` tag. Record the exact reviewed tag in the acceptance checklist.

For later milestones, record each milestone's deliverables and prepare its own explicit export list. Verify client-approved assets and destination before adding them. The GitLab acceptance copy remains a separate destination until the client supplies its URL and access.
