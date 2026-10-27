@echo off
setlocal
REM ===================================================================
REM  Sistema Pagasa - DIAGNOSTICO DEL SERVIDOR
REM
REM  Junta en backups\diagnostico.txt lo necesario para saber por que
REM  algo falla (versiones, estado de git, base de datos, puertos,
REM  espacio, ultimo build). NO incluye contrasenas ni el contenido de
REM  .env: solo dice que claves tiene. Mandale ese archivo a Leonardo.
REM ===================================================================

cd /d "%~dp0.."
if not exist "backups" mkdir "backups"
set "SALIDA=backups\diagnostico.txt"

echo Generando diagnostico...
> "%SALIDA%" echo ===== DIAGNOSTICO SISTEMA PAGASA =====
>> "%SALIDA%" echo Fecha: %date% %time%
>> "%SALIDA%" echo Equipo: %COMPUTERNAME%
>> "%SALIDA%" echo Carpeta: %cd%
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Versiones -----
(node -v 2>&1) >> "%SALIDA%" 2>&1
(call npm -v 2>&1) >> "%SALIDA%" 2>&1
(git --version 2>&1) >> "%SALIDA%" 2>&1
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Git -----
(git status 2>&1) >> "%SALIDA%" 2>&1
(git log --oneline -5 2>&1) >> "%SALIDA%" 2>&1
(git remote -v 2>&1) >> "%SALIDA%" 2>&1
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Claves en .env (sin valores) -----
if exist ".env" (
  for /f "tokens=1 delims==" %%k in ('findstr /r "^[A-Z_]*=" ".env"') do >> "%SALIDA%" echo %%k
) else (
  >> "%SALIDA%" echo NO HAY ARCHIVO .env
)
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Base de datos y migraciones -----
(dir prisma\dev.db 2>&1) >> "%SALIDA%" 2>&1
(call npx prisma migrate status 2>&1) >> "%SALIDA%" 2>&1
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Puertos 3000 / 3443 -----
(netstat -ano | findstr ":3000 :3443") >> "%SALIDA%" 2>&1
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Certificados HTTPS -----
(dir certificados 2>&1) >> "%SALIDA%" 2>&1
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Espacio en disco -----
(powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName,@{n='LibreGB';e={[math]::Round($_.FreeSpace/1GB,1)}},@{n='TotalGB';e={[math]::Round($_.Size/1GB,1)}} | Format-Table -AutoSize | Out-String" 2>&1) >> "%SALIDA%" 2>&1
>> "%SALIDA%" echo.
>> "%SALIDA%" echo ----- Ultimo build (ultimas 60 lineas) -----
if exist "backups\ultimo-build.log" (
  (powershell -NoProfile -Command "Get-Content 'backups\ultimo-build.log' -Tail 60") >> "%SALIDA%" 2>&1
) else (
  >> "%SALIDA%" echo No hay registro de build.
)

echo.
echo Listo: %SALIDA%
echo Mandale ese archivo a Leonardo.
echo.
pause
