# build-apk.ps1 -- Limpa, sincroniza e gera APK

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  KING BT -- Build APK" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$src = "C:\Users\JoffreRibeiro\OneDrive\Documentos\Sistemas\King_BT\kingbt"
$dst = "C:\KINGBT"

# 1. Matar processos que travam arquivos
Write-Host "`n1/4  Encerrando processos..." -ForegroundColor Yellow
Get-Process -Name "java","gradle" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
Write-Host "     OK" -ForegroundColor Green

# 2. Sincronizar OneDrive -> C:\KINGBT (codigo fonte)
Write-Host "`n2/4  Sincronizando codigo..." -ForegroundColor Yellow
$excludeDirs  = @("node_modules", ".expo", "ios", "dist", ".git", "android\build", "android\.gradle")
$excludeFiles = @("*.keystore", "*.log")

$allFiles = [System.IO.Directory]::GetFiles($src, "*", [System.IO.SearchOption]::AllDirectories)
$count = 0
foreach ($srcFile in $allFiles) {
    $skip = $false
    foreach ($ex in $excludeDirs) {
        if ($srcFile.Contains("\$ex\") -or $srcFile.EndsWith("\$ex")) { $skip = $true; break }
    }
    if ($skip) { continue }
    $fname = [System.IO.Path]::GetFileName($srcFile)
    foreach ($ex in $excludeFiles) {
        if ($fname -like $ex) { $skip = $true; break }
    }
    if ($skip) { continue }
    $rel = $srcFile.Substring($src.Length)
    $dstFile = $dst + $rel
    $dstDir = [System.IO.Path]::GetDirectoryName($dstFile)
    if (-not [System.IO.Directory]::Exists($dstDir)) {
        [System.IO.Directory]::CreateDirectory($dstDir) | Out-Null
    }
    [System.IO.File]::Copy($srcFile, $dstFile, $true)
    $count++
}
Write-Host "     $count arquivos sincronizados" -ForegroundColor Green

# 3. Limpar pasta build (inclui o cache de autolinking, que guarda caminhos absolutos)
Write-Host "`n3/4  Limpando build anterior..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$dst\android\app\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$dst\android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$dst\android\.gradle" -ErrorAction SilentlyContinue
Write-Host "     OK" -ForegroundColor Green

# 4. Gerar APK
Write-Host "`n4/4  Gerando APK..." -ForegroundColor Yellow
Set-Location "$dst\android"
& .\gradlew assembleRelease

if ($LASTEXITCODE -eq 0) {
    $apk = "$dst\android\app\build\outputs\apk\release\app-release.apk"
    Write-Host "`n=====================================================" -ForegroundColor Green
    Write-Host "  APK GERADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "  $apk" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green

    # Instalar no celular se estiver conectado
    $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    if (Test-Path $adb) {
        $devices = & $adb devices | Select-String "device$"
        if ($devices) {
            Write-Host "`nCelular detectado! Instalando..." -ForegroundColor Yellow
            & $adb install -r $apk
            Write-Host "APK instalado no celular!" -ForegroundColor Green
        }
    }
} else {
    Write-Host "`nErro no build. Verifique os logs acima." -ForegroundColor Red
}
