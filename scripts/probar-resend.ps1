# Prueba manual: solo envia un correo de configuracion, sin consultar precios.
# La clave se solicita oculta y no se guarda en archivos ni variables de entorno.
$ErrorActionPreference = 'Stop'
$resendKey = $null
$secureKey = $null
$headers = $null

try {
    Write-Host 'Prueba de correo de SteamPulse (Resend).'
    Write-Host 'Usa el correo de tu cuenta de Resend; el remitente de prueba solo permite ese destinatario.'
    $recipient = (Read-Host 'Correo destinatario').Trim()
    try {
        $address = [System.Net.Mail.MailAddress]::new($recipient)
        if ($address.Address -cne $recipient -or $recipient -match '[\r\n]') {
            throw 'invalid'
        }
    } catch {
        throw 'El correo no es valido. Ejecuta otra vez la prueba con una sola direccion.'
    }

    $secureKey = Read-Host 'Pega tu clave de Resend (no se mostrara)' -AsSecureString
    $credential = [System.Management.Automation.PSCredential]::new('resend', $secureKey)
    $resendKey = $credential.GetNetworkCredential().Password.Trim()
    $credential = $null
    if ($resendKey -notmatch '^re_[A-Za-z0-9_-]+$') {
        throw 'La clave debe comenzar con re_ y no contener espacios.'
    }

    $headers = @{ Authorization = "Bearer $resendKey" }
    $payload = @{
        from = 'SteamPulse <onboarding@resend.dev>'
        to = @($recipient)
        subject = 'SteamPulse: prueba de configuracion de correo'
        text = "Esta es una prueba de configuracion solicitada por el propietario de SteamPulse.`n`nNo es una alerta de precio. Las alertas automaticas todavia no estan activadas.`n`nTu web: https://salesplataforms.onrender.com/"
    } | ConvertTo-Json -Compress

    try {
        $response = Invoke-RestMethod -Uri 'https://api.resend.com/emails' -Method Post `
            -Headers $headers -ContentType 'application/json; charset=utf-8' `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 25
    } catch {
        # No imprimir la excepcion del proveedor: puede contener datos sensibles.
        $status = 0
        if ($null -ne $_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        switch ($status) {
            401 { throw 'Resend rechazo la clave. Revisa que este completa y activa.' }
            403 { throw 'Resend rechazo el envio. Usa el correo de tu cuenta de Resend y revisa los permisos de envio de la clave.' }
            429 { throw 'Resend limito los envios. Espera antes de probar otra vez.' }
            default { throw 'No se pudo confirmar el envio. Revisa Emails en Resend antes de repetir: pudo haberse aceptado aunque la conexion fallara.' }
        }
    }

    if (-not $response.id) {
        throw 'Respuesta sin confirmacion. Revisa Emails en Resend antes de repetir la prueba.'
    }
    Write-Host 'Resend acepto el correo. Revisa tu bandeja de entrada y spam.' -ForegroundColor Green
    Write-Host 'En Resend > Emails puedes comprobar si figura como Delivered (entregado).'
    Write-Host 'Esta prueba no activa alertas automaticas.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    if ($null -ne $headers) { $headers.Clear() }
    $resendKey = $null
    $credential = $null
    if ($null -ne $secureKey) { $secureKey.Dispose() }
}
