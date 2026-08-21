@echo off
setlocal
REM ===================================================================
REM  Sistema Pagasa - PREPARAR LA COPIA PARA LA COMPUTADORA SERVIDOR
REM
REM  Copia a una USB (o a donde se le indique) todo lo que hace falta
REM  para levantar el sistema en otra computadora, y nada mas.
REM
REM  Uso:  preparar-copia-para-servidor.bat E:\Pagasa
REM        (donde E: es la USB)
REM
REM  QUE SE LLEVA:
REM    - Todo el codigo y el historial de git
REM    - prisma\dev.db      <- la base de datos con los datos reales
REM    - uploads\           <- los PDFs y fotos subidos
REM    - .env               <- las claves del sistema
REM
REM  QUE NO SE LLEVA (a proposito):
REM    - node_modules\  y  .next\   se regeneran alla con npm install
REM    - backups\                   son 2.5 GB de historico; el servidor
REM                                 genera los suyos
REM ===================================================================

cd /d "%~dp0.."

if "%~1"=="" (
  echo.
  echo   Falta decir a donde copiar.
  echo.
  echo   Ejemplo:  preparar-copia-para-servidor.bat E:\Pagasa
  echo.
  pause
  exit /b 1
)

set "DESTINO=%~1"

echo ==========================================
echo   Preparando copia para el servidor
echo ==========================================
echo.
echo   Desde:  %CD%
echo   Hacia:  %DESTINO%
echo.

REM /E copia subcarpetas incluidas las vacias; /XD excluye carpetas.
robocopy "%CD%" "%DESTINO%" /E /XD "node_modules" ".next" "backups" /NFL /NDL /NJH
REM robocopy usa codigos 0-7 para exito; 8 o mas es error de verdad.
if errorlevel 8 goto :error

echo.
echo ==========================================
echo   Copia terminada
echo ==========================================
echo.
echo   Revisa que en %DESTINO% existan:
if exist "%DESTINO%\prisma\dev.db" (echo     [OK] prisma\dev.db) else (echo     [FALTA] prisma\dev.db)
if exist "%DESTINO%\uploads"      (echo     [OK] uploads\)      else (echo     [FALTA] uploads\)
if exist "%DESTINO%\.env"         (echo     [OK] .env)          else (echo     [FALTA] .env)
if exist "%DESTINO%\package.json" (echo     [OK] el codigo)     else (echo     [FALTA] el codigo)
echo.
echo   En la computadora servidor hay que instalar antes
echo   Node.js 24 o mas nuevo, y Git.
echo.
goto :fin

:error
echo.
echo   *** Hubo un error al copiar. Revisa que haya espacio ***
echo   *** en el destino y que la USB no este protegida.    ***
echo.

:fin
pause
