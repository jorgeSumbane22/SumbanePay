@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ========================================
echo  SumbanePay - Instalar users-lock.js
echo ========================================
echo.

REM Backup
if not exist pages_backup (
    echo [1/3] A criar backup...
    xcopy /E /I /Q pages pages_backup >nul
) else (
    echo [1/3] Backup ja existe.
)

echo [2/3] A inserir users-lock.js nas paginas do utilizador...
for %%F in (pages\*.html) do (
    echo %%F | findstr /i "login.html cadastro.html recuperar-palavra-passe.html 404.html" >nul
    if errorlevel 1 (
        powershell -NoProfile -Command ^
          "$p='%%F'; $c=Get-Content $p -Raw; if ($c -notmatch 'users-lock\.js') { $c=$c -replace '(<meta charset=\"[^\"]*\">)','$1`r`n    <script src=\"../users-lock.js\"></script>'; Set-Content $p -Value $c -NoNewline; Write-Host '  Adicionado:' $p }"
    )
)

echo [3/3] A inserir users-lock.js nas paginas do superadmin...
for %%F in (pages\superadmin_sumbanepay\*.html) do (
    echo %%F | findstr /i "superadmin-login.html" >nul
    if errorlevel 1 (
        powershell -NoProfile -Command ^
          "$p='%%F'; $c=Get-Content $p -Raw; if ($c -notmatch 'users-lock\.js') { $c=$c -replace '(<meta charset=\"[^\"]*\">)','$1`r`n    <script src=\"../../users-lock.js\"></script>'; Set-Content $p -Value $c -NoNewline; Write-Host '  Adicionado:' $p }"
    )
)

echo.
echo Concluido!
echo.
pause