# sync-to-d.ps1 — Sincroniza E:\kingbt para D:\KINGBT
# Usa .NET IO para lidar com pastas com parenteses e colchetes

$src = "e:\MEUS DOCUMENTOS\OneDrive\Documentos\Sistemas\King_BT\kingbt"
$dst = "D:\KINGBT"

$excludeDirs  = @("node_modules", ".expo", "android", "ios", "dist", ".git")
$excludeFiles = @("meu_keystore", "king-bt-release.keystore", "*.keystore")

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  KING BT -- Sincronizando E:\ para D:\KINGBT" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$count = 0
$errors = 0

# Listar todos os arquivos do src recursivamente
$allFiles = [System.IO.Directory]::GetFiles($src, "*", [System.IO.SearchOption]::AllDirectories)

foreach ($srcFile in $allFiles) {
    # Verificar se está em pasta excluída
    $skip = $false
    foreach ($ex in $excludeDirs) {
        if ($srcFile.Contains("\$ex\") -or $srcFile.EndsWith("\$ex")) {
            $skip = $true; break
        }
    }
    if ($skip) { continue }

    # Verificar se é arquivo excluído
    $fname = [System.IO.Path]::GetFileName($srcFile)
    foreach ($ex in $excludeFiles) {
        if ($fname -like $ex) { $skip = $true; break }
    }
    if ($skip) { continue }

    # Calcular path de destino
    $rel = $srcFile.Substring($src.Length)
    $dstFile = $dst + $rel

    # Criar diretório se não existir
    $dstDir = [System.IO.Path]::GetDirectoryName($dstFile)
    if (-not [System.IO.Directory]::Exists($dstDir)) {
        [System.IO.Directory]::CreateDirectory($dstDir) | Out-Null
    }

    # Copiar apenas se diferente (por data ou tamanho)
    $copy = $true
    if ([System.IO.File]::Exists($dstFile)) {
        $srcInfo = [System.IO.FileInfo]::new($srcFile)
        $dstInfo = [System.IO.FileInfo]::new($dstFile)
        if ($srcInfo.LastWriteTimeUtc -le $dstInfo.LastWriteTimeUtc -and $srcInfo.Length -eq $dstInfo.Length) {
            $copy = $false
        }
    }

    if ($copy) {
        try {
            [System.IO.File]::Copy($srcFile, $dstFile, $true)
            $count++
        } catch {
            Write-Host "  ERRO: $rel" -ForegroundColor Red
            $errors++
        }
    }
}

Write-Host "✅ $count arquivo(s) atualizado(s)" -ForegroundColor Green
if ($errors -gt 0) { Write-Host "⚠️  $errors erro(s)" -ForegroundColor Yellow }
Write-Host ""
