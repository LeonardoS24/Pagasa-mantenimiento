@echo off
setlocal EnableDelayedExpansion
REM ===================================================================
REM  Sistema Pagasa - RESTAURAR DESDE LA "COPIA DE SEGURIDAD SERVIDOR"
REM
REM  Solo para cuando se perdio o se dano la base de datos del servidor.
REM  Pone en su lugar una copia de la memoria USB (carpeta
REM  "Copia de seguridad servidor\base") y recupera de la memoria los
REM  archivos de uploads\ que falten. No borra nada: la base actual se
REM  guarda antes en backups\antes-de-restaurar\.
REM ===================================================================

cd /d "%~dp0.."

echo ==========================================
echo   Restaurar el Sistema Pagasa
echo ==========================================
echo.
echo Arrastra a esta ventana el archivo .db de la copia
echo (por ejemplo E:\Copia de seguridad servidor\base\pagasa-2026-10-27_0300.db)
echo y presiona Enter:
echo.
set /p "COPIA=> "
set "COPIA=%COPIA:"=%"
if not exist "%COPIA%" (
  echo.
  echo No se encontro el archivo: %COPIA%
  goto :fin
)

for %%F in ("%COPIA%") do set "CARPETA_BASE=%%~dpF"
set "UPLOADS_COPIA=%CARPETA_BASE%..\uploads"

echo.
echo Se va a restaurar:   %COPIA%
echo Archivos desde:      %UPLOADS_COPIA%
echo.
echo El sistema se detiene mientras tanto. La base actual NO se pierde:
echo queda guardada en backups\antes-de-restaurar\
echo.
set /p "CONFIRMA=Escribe SI para continuar: "
if /i not "%CONFIRMA%"=="SI" (
  echo Cancelado. No se cambio nada.
  goto :fin
)

echo.
echo [1/5] Deteniendo el servidor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/5] Guardando la base actual...
REM La fecha la da PowerShell: %date% cambia de formato segun la region.
for /f %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "MARCA=%%a"
if "%MARCA%"=="" set "MARCA=restauracion"
if not exist "backups\antes-de-restaurar\%MARCA%" mkdir "backups\antes-de-restaurar\%MARCA%"
if exist "prisma\dev.db" copy /Y "prisma\dev.db" "backups\antes-de-restaurar\%MARCA%\dev.db" >nul
if errorlevel 1 goto :error

echo [3/5] Poniendo la copia...
copy /Y "%COPIA%" "prisma\dev.db" >nul
if errorlevel 1 goto :error
if exist "prisma\dev.db-journal" del "prisma\dev.db-journal"

echo [4/5] Recuperando archivos que falten (no se reemplaza ninguno)...
if exist "%UPLOADS_COPIA%" (
  REM /E subcarpetas; /XC /XN /XO = solo los que NO existen en el servidor.
  robocopy "%UPLOADS_COPIA%" "uploads" /E /XC /XN /XO /NP /NFL /NDL /R:1 /W:1
  if !errorlevel! GEQ 8 goto :error
) else (
  echo   No se encontro la carpeta de archivos de la copia. Se deja uploads\ como esta.
)

echo [5/5] Poniendo al dia la estructura de la base...
call npx prisma migrate deploy
if errorlevel 1 goto :error

echo.
echo ==========================================
echo   Listo. Iniciando el servidor...
echo   Base anterior guardada en:
echo   backups\antes-de-restaurar\%MARCA%\dev.db
echo ==========================================
echo.
call npx next start -H 0.0.0.0 -p 3000
goto :fin

:error
echo.
echo ***************************************************
echo   HUBO UN ERROR. Revisa el mensaje de arriba.
echo   La base anterior esta en backups\antes-de-restaurar\
echo   Avisale a Leonardo antes de volver a intentar.
echo ***************************************************
echo.

:fin
pause
