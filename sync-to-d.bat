@echo off
echo.
echo ==============================================
echo   KING BT -- Sincronizando E:\ para D:\KINGBT
echo ==============================================
echo.

robocopy "e:\MEUS DOCUMENTOS\OneDrive\Documentos\Sistemas\King_BT\kingbt" "D:\KINGBT" /MIR /XD node_modules .expo android ios dist .git /XF *.log /NFL /NDL /NJH /NJS /nc /ns /np

echo.
echo ✅ Sincronizacao concluida! D:\KINGBT esta atualizado.
echo.
pause
