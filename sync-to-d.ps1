# sync-to-d.ps1 — Sincroniza E:\kingbt para D:\KINGBT + deploy web
# Usa .NET IO para lidar com pastas com parenteses e colchetes

$src = "e:\MEUS DOCUMENTOS\OneDrive\Documentos\Sistemas\King_BT\kingbt"
$dst = "D:\KINGBT"

$excludeDirs  = @("node_modules", ".expo", "ios", "dist", ".git", "android\build", "android\.gradle")
$excludeFiles = @("meu_keystore", "king-bt-release.keystore", "*.keystore")

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  KING BT -- Sync + Deploy" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# ── 1. Sincronizar E: → D:\KINGBT ────────────────────────────────────────────
Write-Host ""
Write-Host "1/3  Sincronizando arquivos..." -ForegroundColor Yellow

$count = 0
$allFiles = [System.IO.Directory]::GetFiles($src, "*", [System.IO.SearchOption]::AllDirectories)

foreach ($srcFile in $allFiles) {
    $skip = $false
    foreach ($ex in $excludeDirs) {
        if ($srcFile.Contains("\$ex\")) { $skip = $true; break }
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

Write-Host "   ✅ $count arquivos sincronizados para D:\KINGBT" -ForegroundColor Green

# ── 2. Build web ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "2/3  Gerando build web..." -ForegroundColor Yellow

Set-Location $src
$buildResult = & npx expo export --platform web 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Build web gerado em dist/" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Erro no build web:" -ForegroundColor Red
    Write-Host $buildResult
}

# ── 3. Deploy Firebase Hosting ────────────────────────────────────────────────
Write-Host ""
Write-Host "3/3  Publicando no Firebase Hosting..." -ForegroundColor Yellow

$deployResult = & npx firebase deploy --only hosting --project king-bt-7f559 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Deploy publicado em https://king-bt-7f559.web.app" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Erro no deploy:" -ForegroundColor Red
    Write-Host $deployResult
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Tudo pronto!" -ForegroundColor Cyan
Write-Host "  Web: https://king-bt-7f559.web.app" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
