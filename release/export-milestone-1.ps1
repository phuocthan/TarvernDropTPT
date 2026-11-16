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
    'tsconfig.json', 'vite.config.ts', 'server.js', 'server/mock-game.ts',
    'src/style.css', 'src/framework', 'src/games/reuse',
    'src/games/tavern/definition.ts', 'src/games/tavern/game.config.json',
    'tests/rules.test.ts', 'docs/milestone-1.md', 'docs/milestone-1-asset-spec.md',
    'release/milestone-1/main.ts', 'release/milestone-1/catalog.ts',
    'release/milestone-1/README.md'
)
$archive = Join-Path ([System.IO.Path]::GetTempPath()) ("milestone-1-" + [guid]::NewGuid() + ".zip")
try {
    git -C $source archive --format=zip "--output=$archive" $commit -- @entries
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the milestone archive.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $destinationPath
    $profile = Join-Path $destinationPath 'release/milestone-1'
    Move-Item -LiteralPath (Join-Path $profile 'main.ts') -Destination (Join-Path $destinationPath 'src/main.ts')
    Move-Item -LiteralPath (Join-Path $profile 'catalog.ts') -Destination (Join-Path $destinationPath 'src/games/catalog.ts')
    Move-Item -LiteralPath (Join-Path $profile 'README.md') -Destination (Join-Path $destinationPath 'README.md')
    Remove-Item -LiteralPath $profile
    Remove-Item -LiteralPath (Join-Path $destinationPath 'release')
    Set-Content -LiteralPath (Join-Path $destinationPath 'SOURCE_REVISION') -Value $commit
    Write-Output "Exported milestone 1 from $commit to $destinationPath"
} finally {
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
}
