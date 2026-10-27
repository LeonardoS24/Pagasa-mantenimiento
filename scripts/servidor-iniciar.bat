@echo off
REM ===================================================================
REM  Sistema Pagasa - INICIAR EL SERVIDOR
REM
REM  Para la computadora que hace de servidor (la que siempre esta
REM  prendida). Doble clic aqui y dejar la ventana abierta/minimizada.
REM
REM  Arranca con scripts\servidor.mjs (igual que "next start", mas la IP
REM  real de cada equipo en la bitacora de acceso). Escucha en toda la red
REM  local. Si hay certificados en certificados\ (ver
REM  servidor-activar-https.bat) sirve por HTTPS en el 3443 y el 3000 solo
REM  redirige; si no, HTTP en el 3000 como siempre.
REM ===================================================================

cd /d "%~dp0.."

echo ==========================================
echo   Sistema Integral de Mantenimiento
echo   Grupo Pagasa
echo ==========================================
echo.
echo Iniciando el servidor...
echo.
echo NO CIERRES ESTA VENTANA mientras el sistema este en uso.
echo Para apagarlo: cierra esta ventana o presiona Ctrl+C.
echo.

node scripts\servidor.mjs

echo.
echo El servidor se detuvo.
pause
