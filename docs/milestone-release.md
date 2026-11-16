# Client milestone exports

Development continues in `phuocthan/TarvernDropTPT`. The client reviews published snapshots in [phuocthan/DropTarvernRelease](https://github.com/phuocthan/DropTarvernRelease). Its `main` branch holds the latest approved export and milestone tags preserve earlier delivery points. Each snapshot records the source implementation commit in `SOURCE_REVISION`.

## Milestone 1 package

The explicit file list is in [export-milestone-1.ps1](../release/export-milestone-1.ps1). It includes the shared TypeScript/PixiJS core, Tavern 5 × 5 JSON and 3 × 3 reuse configuration, mock API, shared tests, a package lock and build configuration, and the client README and M1 documents. The release entry points mount both configurations using the shared placeholder skin.

The development checkout retains the original reference art, fonts, audio, Spine files, asset viewer, research captures, technical notes, local runtime files, Railway configuration and development Git history. The public preview is built from a clean Git archive of a named commit.

## Export and review

1. Commit the development source and resolve the commit ID.
2. Run `pwsh -File release/export-milestone-1.ps1 -Destination <empty-folder-outside-repo> -Revision <development-commit>`.
3. Verify the exported file list, run `npm ci`, `npm run build`, `npm test` and smoke-test both routes using `npm start`.
4. Commit the resulting files to the client repository. For future exports, use that repository's existing history. Push its delivery branch and milestone tag after review. Record the exact reviewed tag in the acceptance checklist.

For later milestones, record each milestone's deliverables and prepare its own explicit export list. Verify client-approved assets and destination before adding them. The GitLab acceptance copy remains a separate destination until the client supplies its URL and access.
