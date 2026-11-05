$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
if (-not $nodePath) {
    $codexNodePath = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $codexNodePath -PathType Leaf) {
        $nodePath = $codexNodePath
        Write-Host 'Usando Node.js del entorno local de Codex; no se modifica el PATH.'
    }
}
if (-not $nodePath) {
    throw 'No se encontro Node.js. Instala Node.js 24 y vuelve a abrir PowerShell.'
}

# Only public Firebase SDK identifiers are fetched; no user sessions or debug tokens.
$config = Invoke-RestMethod -Uri 'https://salesplataforms.onrender.com/api/auth-config' -TimeoutSec 60
if ($config.projectId -ne 'salesplataforms' -or -not $config.apiKey -or -not $config.appId -or -not $config.authDomain -or $config.appCheckSiteKey -notmatch '^6L[A-Za-z0-9_-]{38}$') {
    throw 'La configuracion publica esta incompleta o no corresponde a salesplataforms.'
}
$localSettings = @{
    FIREBASE_API_KEY = [string]$config.apiKey
    FIREBASE_AUTH_DOMAIN = [string]$config.authDomain
    FIREBASE_PROJECT_ID = [string]$config.projectId
    FIREBASE_APP_ID = [string]$config.appId
    FIREBASE_APPCHECK_SITE_KEY = [string]$config.appCheckSiteKey
    TRUST_PROXY = '0'
    HOST = '127.0.0.1'
    PORT = '3000'
}
$previousSettings = @{}
try {
    foreach ($setting in $localSettings.GetEnumerator()) {
        $previousSettings[$setting.Key] = [Environment]::GetEnvironmentVariable($setting.Key, 'Process')
        [Environment]::SetEnvironmentVariable($setting.Key, $setting.Value, 'Process')
    }
    Write-Host 'Abre http://localhost:3000/ en tu navegador. Para detener el servidor: Ctrl+C.'
    Write-Host 'Usa una cuenta de prueba: los favoritos se guardan en el Firebase real.'
    & $nodePath (Join-Path $projectRoot 'server.cjs')
} finally {
    foreach ($settingName in $previousSettings.Keys) {
        [Environment]::SetEnvironmentVariable($settingName, $previousSettings[$settingName], 'Process')
    }
}
