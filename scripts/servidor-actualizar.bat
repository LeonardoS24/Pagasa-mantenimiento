@echo off
setlocal
REM ===================================================================
REM  Sistema Pagasa - ACTUALIZAR EL SERVIDOR
REM
REM  Para la computadora que hace de servidor. Se corre cuando hay
REM  cambios nuevos del sistema. Hace todo en orden y vuelve a
REM  levantar el servidor al terminar.
REM
REM  IMPORTANTE: usa "prisma migrate deploy", NUNCA "migrate dev".
REM  migrate dev puede reiniciar la base de datos; deploy solo aplica
REM  los cambios pendientes sin tocar los datos.
REM ===================================================================

cd /d "%~dp0.."

echo ==========================================
echo   Actualizando el Sistema Pagasa
echo ==========================================
echo.

echo [1/6] Deteniendo el servidor...
REM Hay que detenerlo si o si: SQLite bloquea el archivo de la base y
REM las migraciones no corren con el servidor encima.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 :3443" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 3 /nobreak >nul

echo [2/6] Respaldando la base de datos...
if not exist "backups\antes-de-actualizar" mkdir "backups\antes-de-actualizar"
copy /Y "prisma\dev.db" "backups\antes-de-actualizar\dev.db" >nul
if errorlevel 1 goto :error

echo [3/6] Trayendo los cambios nuevos...
REM "npm install" reescribe package-lock.json en el servidor y eso hacia que
REM "git pull" se negara a traer los cambios. Ese archivo se regenera solo,
REM asi que aqui se descarta el cambio local (no toca la base ni uploads).
git checkout -- package-lock.json >nul 2>&1
git pull
if errorlevel 1 goto :error

echo [4/6] Revisando dependencias...
call npm install
if errorlevel 1 goto :error

echo [5/6] Aplicando cambios a la base de datos...
call npx prisma migrate deploy
if errorlevel 1 goto :error
call npx prisma generate
if errorlevel 1 goto :error

echo [6/6] Compilando la aplicacion (tarda de 1 a 3 minutos)...
REM La salida va a backups\ultimo-build.log para poder mandarla si falla.
REM En Windows el build a veces falla por archivos viejos o bloqueados de
REM .next (antivirus, OneDrive, un servidor que no se cerro): si falla, se
REM borra .next y se intenta una vez mas desde cero.
call npm run build > "backups\ultimo-build.log" 2>&1
if not errorlevel 1 goto :build_ok
echo   El primer intento fallo. Limpiando y volviendo a compilar...
if exist ".next" rmdir /s /q ".next"
call npm run build > "backups\ultimo-build.log" 2>&1
if errorlevel 1 goto :error_build
:build_ok
echo   Compilado.

echo.
echo ==========================================
echo   Listo. Iniciando el servidor...
echo ==========================================
echo.
node scripts\servidor.mjs
goto :fin

:error_build
echo.
echo ----- Ultimas lineas del error de compilacion -----
powershell -NoProfile -Command "Get-Content 'backups\ultimo-build.log' -Tail 40"
echo ---------------------------------------------------
echo   El registro completo esta en backups\ultimo-build.log
echo   Mandaselo a Leonardo junto con backups\diagnostico.txt
echo   (doble clic en scripts\servidor-diagnostico.bat para crearlo).

:error
echo.
echo ***************************************************
echo   HUBO UN ERROR. El servidor NO se inicio.
echo.
echo   La base de datos NO se modifico, y quedo una
echo   copia en:  backups\antes-de-actualizar\dev.db
echo.
echo   Avisale a Leonardo antes de volver a intentar.
echo ***************************************************
echo.

:fin
pause
