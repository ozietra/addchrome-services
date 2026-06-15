# package-extensions.ps1
# 3 eklentiyi Chrome Web Store'a uygun .zip dosyalarina paketler.
# Calistirmak icin (proje kokunde, PowerShell):
#   powershell -ExecutionPolicy Bypass -File .\package-extensions.ps1
#
# Ne yapar:
#   1) generate-icons.js ile gercek PNG ikonlari uretir (placeholder kalmasin)
#   2) Her eklentiyi dist\<isim>.zip olarak paketler (manifest.json zip kokunde)

$root = $PSScriptRoot
$exts = @("ig-follower-export", "ig-unfollow-ai", "price-compare")
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

# 1) Ikonlari uret (sharp kuruluysa). Hata olursa uyarir ama devam eder.
Write-Host "Ikonlar uretiliyor (node generate-icons.js)..." -ForegroundColor Cyan
try {
    node (Join-Path $root "generate-icons.js")
} catch {
    Write-Warning "Ikon uretimi atlandi. Once 'npm install sharp' calistirip tekrar deneyebilirsiniz."
}

# 2) Paketleme
foreach ($e in $exts) {
    $src = Join-Path $root "extensions\$e"
    if (!(Test-Path $src)) { Write-Warning "Klasor bulunamadi: $src"; continue }

    $zip = Join-Path $dist "$e.zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }

    # 'folder\*' -> dosyalar zip KOKUNE gider (manifest.json en ustte olur)
    Compress-Archive -Path (Join-Path $src "*") -DestinationPath $zip -Force
    $sizeKB = [math]::Round((Get-Item $zip).Length / 1KB, 1)
    Write-Host ("OK  -> {0}  ({1} KB)" -f $zip, $sizeKB) -ForegroundColor Green
}

Write-Host "`nBitti! dist\ klasorundeki 3 zip'i Chrome Web Store paneline yukleyin." -ForegroundColor Cyan
Write-Host "UYARI: Yuklemeden once API adresini (localhost yerine sunucu adresiniz) guncellediginizden emin olun." -ForegroundColor Yellow
