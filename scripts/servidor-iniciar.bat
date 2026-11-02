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
REM  Escucha en toda la red local. Si hay certificados en certificados\ (ver
REM  servidor-activar-https.bat) sirve por HTTPS en el 3443 y el 3000 solo
REM  redirige; si no, HTTP en el 3000 como siempre.
REM
REM  Si el servidor se cae por un error, se vuelve a levantar solo a los
REM  10 segundos y queda anotado en logs\arranques.log.
REM ===================================================================

cd /d "%~dp0.."
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

REM Codigo 2 = el puerto ya estaba ocupado (otro servidor abierto):
REM reintentar no sirve de nada.
if "%CODIGO%"=="2" (
  echo.
  echo El puerto ya esta ocupado: probablemente el sistema ya esta abierto
  echo en otra ventana. Cierra esta.
  goto :fin
)

echo.
echo El servidor se detuvo ^(codigo %CODIGO%^). Se vuelve a iniciar en 10 segundos...
echo Para no reiniciarlo, cierra esta ventana ahora.
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm:ss"') do echo %%t REINICIO automatico tras salir con codigo %CODIGO%>> "logs\arranques.log"
timeout /t 10 /nobreak >nul
goto :arrancar

:fin
pause
