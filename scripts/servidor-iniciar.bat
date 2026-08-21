@echo off
REM ===================================================================
REM  Sistema Pagasa - INICIAR EL SERVIDOR
REM
REM  Para la computadora que hace de servidor (la que siempre esta
REM  prendida). Doble clic aqui y dejar la ventana abierta/minimizada.
REM
REM  -H 0.0.0.0 hace que escuche en toda la red local, no solo en esta
REM  computadora: asi los demas entran con http://IP-DE-ESTA-PC:3000
REM ===================================================================

cd /d "%~dp0.."

echo ==========================================
echo   Sistema Integral de Mantenimiento
echo   Grupo Pagasa
echo ==========================================
echo.
echo Iniciando el servidor...
echo.
echo Los demas se conectan desde su navegador a:
REM Se parte el renglon de ipconfig por los dos puntos y se recortan los
REM espacios: contar palabras no sirve porque el ipconfig en espanol trae
REM una hilera de puntos antes de la direccion.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo    http://%%b:3000
)
echo.
echo NO CIERRES ESTA VENTANA mientras el sistema este en uso.
echo Para apagarlo: cierra esta ventana o presiona Ctrl+C.
echo.

call npx next start -H 0.0.0.0 -p 3000

echo.
echo El servidor se detuvo.
pause
