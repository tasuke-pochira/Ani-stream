$exePath = "dist/AniStream.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "AniStream.exe not found in dist folder!"
    exit 1
}

$certName = "Pochira Software"
$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*CN=$certName*" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "Creating self-signed certificate for '$certName'..."
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=$certName" -FriendlyName "AniStream Code Signing" -CertStoreLocation Cert:\CurrentUser\My
    Write-Host "Certificate created successfully."
}

Write-Host "Signing $exePath..."
$signed = $false
for ($i = 0; $i -lt 5; $i++) {
    try {
        Set-AuthenticodeSignature -FilePath $exePath -Certificate $cert -TimestampServer "http://timestamp.digicert.com" -ErrorAction Stop
        $signed = $true
        break
    } catch {
        Write-Host "  File locked, retrying in 3s... ($($i+1)/5)"
        Start-Sleep -Seconds 3
    }
}

if (-not $signed) {
    Write-Warning "Could not sign EXE (file locked). Skipping signing step."
}

Write-Host "Sign check result:"
Get-AuthenticodeSignature $exePath | Format-List
