@echo off
setlocal EnableDelayedExpansion
REM ===================================================================
REM  Sistema Pagasa - IMPORTAR LOS DATOS DE VALVULAS Y TRANSPORTADORA KINO
REM
REM  Para la computadora SERVIDOR. Se corre DESPUES de servidor-actualizar.bat
REM  (que trae el codigo nuevo y aplica los cambios de estructura).
REM
REM  Que hace, en orden, sin que haya que escribir nada:
REM    1. Busca la USB con la carpeta TRANSPORTADORA KINO y el Excel de
REM       la flotilla (en cualquier letra de unidad).
REM    2. Detiene el servidor y respalda la base de datos.
REM    3. SIMULA las dos importaciones y te muestra el resumen.
REM    4. Si escribes SI, las guarda de verdad.
REM    5. Vuelve a simular para comprobar que quedo todo (debe decir 0).
REM    6. Vuelve a levantar el servidor.
REM
REM  Se puede correr varias veces sin duplicar nada: solo llena lo que
REM  falta y nunca pisa lo que alguien ya capturo.
REM
REM  Uso opcional:  servidor-importar-datos.bat E:\   (si ya sabes la unidad)
REM ===================================================================

cd /d "%~dp0.."

echo ==========================================
echo   Importar datos al Sistema Pagasa
echo ==========================================
echo.

REM ---- 1. Buscar la USB ----------------------------------------------
set "KINO="
set "EXCEL="
if not "%~1"=="" (
  set "RAIZ=%~1"
  if "!RAIZ:~-1!"=="\" set "RAIZ=!RAIZ:~0,-1!"
  if exist "!RAIZ!\TRANSPORTADORA KINO\Control de documentos por unidad - Transportadora Kino.xlsx" set "KINO=!RAIZ!\TRANSPORTADORA KINO"
  if exist "!RAIZ!\Flotilla Pagasa - Unidades_1.xlsx" set "EXCEL=!RAIZ!\Flotilla Pagasa - Unidades_1.xlsx"
)
for %%L in (D E F G H I J K L M N O P Q R S T U V W X Y Z C) do (
  if not defined KINO if exist "%%L:\TRANSPORTADORA KINO\Control de documentos por unidad - Transportadora Kino.xlsx" set "KINO=%%L:\TRANSPORTADORA KINO"
  if not defined EXCEL if exist "%%L:\Flotilla Pagasa - Unidades_1.xlsx" set "EXCEL=%%L:\Flotilla Pagasa - Unidades_1.xlsx"
)

if not defined KINO goto :falta_usb
if not defined EXCEL goto :falta_usb
echo   Carpeta de Kino : !KINO!
echo   Excel flotilla  : !EXCEL!
echo.

if not exist "node_modules" (
  echo   Falta instalar el sistema. Primero corre servidor-actualizar.bat
  goto :error_sin_reinicio
)

REM ---- 2. Detener el servidor y respaldar ----------------------------
echo [1/5] Deteniendo el servidor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/5] Respaldando la base de datos...
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set "SELLO=%%t"
if not exist "backups\antes-de-importar" mkdir "backups\antes-de-importar"
copy /Y "prisma\dev.db" "backups\antes-de-importar\dev-!SELLO!.db" >nul
if errorlevel 1 goto :error
set "LOG=backups\antes-de-importar\registro-!SELLO!"
echo       Copia guardada en backups\antes-de-importar\dev-!SELLO!.db
echo.

REM ---- 3. Simulacion -------------------------------------------------
echo [3/5] Simulando (todavia NO se guarda nada)...
call npx tsx scripts\importar-valvulas-flotilla.mts "!EXCEL!" > "!LOG!-1-simulacion-valvulas.txt" 2>&1
if errorlevel 1 goto :error
call npx tsx scripts\crear-transportadora-kino.mts "!KINO!" > "!LOG!-2-simulacion-kino.txt" 2>&1
if errorlevel 1 goto :error

echo.
echo ----- RESUMEN: VALVULAS Y ULTRASONIDOS -----
call :resumen "!LOG!-1-simulacion-valvulas.txt"
echo.
echo ----- RESUMEN: TRANSPORTADORA KINO -----
call :resumen "!LOG!-2-simulacion-kino.txt"
echo.
echo   (El detalle completo quedo en la carpeta backups\antes-de-importar)
echo.
echo ==========================================
echo   Revisa los resumenes de arriba.
echo   Si todo se ve bien, escribe SI y Enter para GUARDAR.
echo   Para cancelar sin guardar nada, solo cierra esta ventana
echo   o escribe cualquier otra cosa.
echo ==========================================
set "RESP="
set /p "RESP=  Guardar? (SI): "
if /i not "!RESP!"=="SI" goto :cancelado

REM ---- 4. Guardar ----------------------------------------------------
echo.
echo [4/5] Guardando...
call npx tsx scripts\importar-valvulas-flotilla.mts "!EXCEL!" --apply > "!LOG!-3-guardado-valvulas.txt" 2>&1
if errorlevel 1 goto :error
call npx tsx scripts\crear-transportadora-kino.mts "!KINO!" --apply > "!LOG!-4-guardado-kino.txt" 2>&1
if errorlevel 1 goto :error

REM ---- 5. Verificar --------------------------------------------------
echo [5/5] Verificando que quedo todo (los dos deben decir 0)...
call npx tsx scripts\importar-valvulas-flotilla.mts "!EXCEL!" > "!LOG!-5-verificacion-valvulas.txt" 2>&1
call npx tsx scripts\crear-transportadora-kino.mts "!KINO!" > "!LOG!-6-verificacion-kino.txt" 2>&1
echo.
echo ----- VERIFICACION: VALVULAS (debe decir "Unidades con datos nuevos: 0") -----
call :resumen "!LOG!-5-verificacion-valvulas.txt"
echo.
echo ----- VERIFICACION: KINO (debe decir "Unidades nuevas: 0" y "Conjuntos nuevos: 0") -----
call :resumen "!LOG!-6-verificacion-kino.txt"
echo.
echo ==========================================
echo   LISTO. Los datos se importaron.
echo   Iniciando el servidor...
echo ==========================================
echo.
call "%~dp0servidor-iniciar.bat"
goto :fin

:resumen
powershell -NoProfile -Command "$t = Get-Content -Raw -Encoding UTF8 '%~1'; $i = $t.IndexOf('=== Resumen'); if ($i -ge 0) { $t.Substring($i) } else { $t }"
exit /b 0

:falta_usb
echo ***************************************************
echo   No encontre la USB con los datos.
echo.
if not defined KINO echo   Falta la carpeta:  TRANSPORTADORA KINO
if not defined EXCEL echo   Falta el archivo:  Flotilla Pagasa - Unidades_1.xlsx
echo.
echo   Conecta la USB (o copia esas dos cosas al servidor)
echo   y vuelve a dar doble clic. No se cambio nada.
echo ***************************************************
goto :fin

:cancelado
echo.
echo   Cancelado. No se guardo nada en la base de datos.
echo   (El servidor sigue detenido; se vuelve a iniciar abajo.)
echo.
call "%~dp0servidor-iniciar.bat"
goto :fin

:error
echo.
echo ***************************************************
echo   HUBO UN ERROR. Avisale a Leonardo y mandale los
echo   archivos de la carpeta backups\antes-de-importar
echo   (los que empiezan con "registro-").
echo.
echo   La base tiene un respaldo de antes de empezar en
echo   backups\antes-de-importar\dev-!SELLO!.db
echo   Puedes volver a correr este archivo: no duplica nada.
echo ***************************************************
echo.
echo   Se va a iniciar el servidor para que el equipo pueda trabajar.
pause
call "%~dp0servidor-iniciar.bat"
goto :fin

:error_sin_reinicio
echo.
echo   No se cambio nada.

:fin
pause
