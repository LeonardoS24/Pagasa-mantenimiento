@echo off
setlocal
REM ===================================================================
REM  Sistema Pagasa - INICIAR EL SERVIDOR
REM
REM  Para la computadora que hace de servidor (la que siempre esta
REM  prendida). Doble clic aqui y dejar la ventana abierta/minimizada.
REM
REM  Arranca con scripts\servidor.mjs (igual que "next start", mas la IP
REM  real de cada equipo en la bitacora de acceso y el registro en logs\).
REM  Si hay certificados en certificados\ (servidor-activar-https.bat)
REM  sirve por HTTPS en el 3443 y el 3000 solo redirige.
REM
REM  Si el servidor se CAE por un error, se vuelve a levantar solo a los
REM  10 segundos (queda anotado en logs\arranques.log). Si lo DETIENEN a
REM  proposito (actualizar, restaurar, importar o a mano), no lo revive.
REM ===================================================================

REM Corre desde una copia en la carpeta temporal: mientras el servidor
REM esta prendido esta ventana espera aqui, y si una actualizacion
REM ("git pull") reemplaza este archivo, Windows seguiria leyendolo por
REM posicion y ejecutaria renglones cortados.
if /i not "%~1"=="--copia" (
  set "COPIA=%TEMP%\pagasa-servidor-%RANDOM%%RANDOM%.bat"
  call copy /Y "%~f0" "%%COPIA%%" >nul
  call "%%COPIA%%" --copia "%~dp0."
  exit /b
)
cd /d "%~2\.."
title Servidor Pagasa
if not exist "logs" mkdir "logs"

echo ==========================================
echo   Sistema Integral de Mantenimiento
echo   Grupo Pagasa
echo ==========================================
echo.
echo NO CIERRES ESTA VENTANA mientras el sistema este en uso.
echo Para apagarlo: cierra esta ventana o presiona Ctrl+C.
echo.

:arrancar
node scripts\servidor.mjs
set "CODIGO=%errorlevel%"

REM 2 = no pudo usar el puerto (ya ocupado o reservado por Windows).
if "%CODIGO%"=="2" (
  echo.
  echo El puerto ya esta ocupado o reservado: probablemente el sistema ya
  echo esta abierto en otra ventana. Cierra esta.
  goto :fin
)
REM 1 = lo detuvo taskkill (actualizar, restaurar, importar) y 0 = salida
REM normal: no se revive, quien lo detuvo lo vuelve a iniciar.
if "%CODIGO%"=="1" goto :detenido
if "%CODIGO%"=="0" goto :detenido

echo.
echo El servidor se cayo ^(codigo %CODIGO%^). Se vuelve a iniciar en 10 segundos...
echo Para no reiniciarlo, cierra esta ventana ahora.
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm:ss"') do >>"logs\arranques.log" echo %%t REINICIO automatico tras caida, codigo %CODIGO%
timeout /t 10 /nobreak >nul
goto :arrancar

:detenido
echo.
echo El servidor se detuvo.

:fin
pause
