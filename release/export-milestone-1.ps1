param(
    [Parameter(Mandatory)][string]$Destination,
    [string]$Revision = 'HEAD'
)

$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
$sourcePath = [System.IO.Path]::GetFullPath($source)
if ($destinationPath.Equals($sourcePath, 'OrdinalIgnoreCase') -or
    $destinationPath.StartsWith($sourcePath + [System.IO.Path]::DirectorySeparatorChar, 'OrdinalIgnoreCase')) {
    throw 'Use a separate export directory outside the development repository.'
}
if ((Test-Path -LiteralPath $destinationPath) -and (Get-ChildItem -Force -LiteralPath $destinationPath)) {
    throw 'The export directory must be empty.'
}

$commit = git -C $source rev-parse --verify "$Revision^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'Select an existing development commit.' }
$entries = @(
    '.gitignore', 'index.html', 'package.json', 'package-lock.json',
    'tsconfig.json', 'vite.config.ts', 'server.js', 'server/mock-game.ts', 'server/proposal-backend.ts', 'tools',
    'src/style.css', 'src/framework', 'src/games/reuse',
    'src/games/tavern/definition.ts', 'src/games/tavern/game.config.json',
    'tests/rules.test.ts', 'tests/proposal-backend.test.ts', 'tests/proposal-transport.test.ts',
    'tests/resources.test.ts', 'tests/milestone-config.test.ts', 'tests/landing-motion.test.ts', 'tests/slot-content-fit.test.ts',
    'docs/milestone-1.md', 'docs/milestone-1-asset-spec.md',
    'docs/milestone-1-api.md', 'docs/milestone-1-v1-examples.json', 'docs/milestone-1-evidence',
    'docs/backend-localhost-v1.md', 'docs/FE-BE-Proposal.md', 'docs/fw-pixi-architecture.md',
    'release/milestone-1/main.ts', 'release/milestone-1/catalog.ts',
    'release/milestone-1/architecture.md', 'release/milestone-1/smoke.spec.ts',
    'release/milestone-1/playwright.config.ts',
    'release/milestone-1/README.md'
)
$mockPolicyPath = 'server/demo-check.config.json'
if (git -C $source ls-tree --name-only $commit -- $mockPolicyPath) {
    $entries += $mockPolicyPath
}
$archive = Join-Path ([System.IO.Path]::GetTempPath()) ("milestone-1-" + [guid]::NewGuid() + ".zip")
try {
    git -C $source archive --format=zip "--output=$archive" $commit -- @entries
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the milestone archive.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $destinationPath
    $profile = Join-Path $destinationPath 'release/milestone-1'
    Move-Item -LiteralPath (Join-Path $profile 'main.ts') -Destination (Join-Path $destinationPath 'src/main.ts')
    Move-Item -LiteralPath (Join-Path $profile 'catalog.ts') -Destination (Join-Path $destinationPath 'src/games/catalog.ts')
    Move-Item -LiteralPath (Join-Path $profile 'README.md') -Destination (Join-Path $destinationPath 'README.md')
    Move-Item -LiteralPath (Join-Path $profile 'architecture.md') -Destination (Join-Path $destinationPath 'docs/architecture.md')
    New-Item -ItemType Directory -Path (Join-Path $destinationPath 'tests/browser') -Force | Out-Null
    Move-Item -LiteralPath (Join-Path $profile 'smoke.spec.ts') -Destination (Join-Path $destinationPath 'tests/browser/milestone-1.spec.ts')
    Move-Item -LiteralPath (Join-Path $profile 'playwright.config.ts') -Destination (Join-Path $destinationPath 'playwright.config.ts')
    # Public M1 runs the shared placeholder skin; no reference CDN dependency or asset URLs.
    $configPath = Join-Path $destinationPath 'src/games/tavern/game.config.json'
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding utf8 | ConvertFrom-Json
    $config.resources = [pscustomobject]@{ assets = [pscustomobject]@{}; bundles = [pscustomobject]@{ core = [pscustomobject]@{ assets = @() } }; startup = @('core'); concurrency = 4; retries = 1 }
    $config.presentation.PSObject.Properties.Remove('loadingScreen')
    $config.routing.skin = 'basic'
    $config | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $configPath -Encoding utf8
    $proposalPath = Join-Path $destinationPath 'docs/FE-BE-Proposal.md'
    $proposalText = Get-Content -LiteralPath $proposalPath -Raw -Encoding utf8
    $proposalText.Replace('backend-mock-examples-client-review.md', 'milestone-1-api.md').TrimEnd() |
      Set-Content -LiteralPath $proposalPath -Encoding utf8
    Remove-Item -LiteralPath $profile
    Remove-Item -LiteralPath (Join-Path $destinationPath 'release')
    Set-Content -LiteralPath (Join-Path $destinationPath 'SOURCE_REVISION') -Value $commit
    $manifest = Get-ChildItem -LiteralPath $destinationPath -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($destinationPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar).Length + 1).Replace('\', '/')
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        if ($_.Extension -in @('.ts', '.js', '.mjs', '.json', '.md', '.txt', '.css', '.html') -or $relative -in @('.gitignore', 'SOURCE_REVISION')) {
            $text = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8).Replace("`r`n", "`n")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
        }
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() }
        finally { $sha.Dispose() }
        [pscustomobject]@{ path = $relative; sha256 = $hash }
    }
    [pscustomobject]@{ milestone = 'M1'; checksumNormalization = 'UTF-8 text without BOM with LF; binary unchanged'; sourceRevision = $commit; files = @($manifest) } |
      ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destinationPath 'EXPORT_MANIFEST.json') -Encoding utf8
    Write-Output "Exported milestone 1 from $commit to $destinationPath"
} finally {
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
}
