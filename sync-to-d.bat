@echo off
echo.
echo ==============================================
echo   KING BT -- Sincronizando E:\ para D:\KINGBT
echo ==============================================
echo.

set SRC=e:\MEUS DOCUMENTOS\OneDrive\Documentos\Sistemas\King_BT\kingbt
set DST=D:\KINGBT

:: Sync geral (exclui pastas especiais e keystores)
robocopy "%SRC%" "%DST%" /MIR /XD node_modules .expo android ios dist .git app /XF "*.log" "meu_keystore" "king-bt-release.keystore" "*.keystore" /NFL /NDL /NJH /NJS /nc /ns /np

:: Sync app/ separado (sem /MIR para nao apagar pastas com colchetes)
robocopy "%SRC%\app" "%DST%\app" /E /XD node_modules /XF "*.log" /NFL /NDL /NJH /NJS /nc /ns /np

:: Copiar analise/[matchId] manualmente (robocopy nao lida bem com colchetes)
if not exist "%DST%\app\analise\[matchId]" mkdir "%DST%\app\analise\[matchId]"
copy /Y "%SRC%\app\analise\[matchId]\ponto.tsx" "%DST%\app\analise\[matchId]\ponto.tsx" > nul
copy /Y "%SRC%\app\analise\[matchId]\relatorio.tsx" "%DST%\app\analise\[matchId]\relatorio.tsx" > nul
copy /Y "%SRC%\app\analise\[matchId]\_layout.tsx" "%DST%\app\analise\[matchId]\_layout.tsx" > nul

echo.
echo ✅ Sincronizacao concluida! D:\KINGBT esta atualizado.
echo.
pause
