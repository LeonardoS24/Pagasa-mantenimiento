@echo off
setlocal
REM ===================================================================
REM  Sistema Pagasa - DEJAR EL SERVIDOR PRENDIDO SOLO
REM
REM  Doble clic en la computadora que hace de servidor. Crea la tarea
REM  programada de Windows que levanta el sistema al encender la
REM  computadora (ver servidor-instalar-arranque.ps1 y SERVIDOR.md).
REM
REM  Opciones:   servidor-instalar-arranque.bat -SoloVerificar
REM              servidor-instalar-arranque.bat -Quitar
REM ===================================================================

REM Pide permiso de administrador (Windows lo necesita para crear la tarea).
net session >nul 2>&1
if errorlevel 1 (
  echo Pidiendo permiso de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-instalar-arranque.ps1" %*
echo.
pause
