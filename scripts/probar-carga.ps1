param([switch]$Render)
$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
if (-not $nodePath) {
    $codexNodePath = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $codexNodePath -PathType Leaf) { $nodePath = $codexNodePath }
}
if (-not $nodePath) { throw 'No se encontro Node.js. Instala Node.js 24 y vuelve a abrir PowerShell.' }
$runner = Join-Path $PSScriptRoot 'prueba-carga.cjs'
if ($Render) { & $nodePath $runner --render } else { & $nodePath $runner }
if ($LASTEXITCODE -ne 0) { throw 'La prueba no pudo completarse; revisa el error anterior.' }
