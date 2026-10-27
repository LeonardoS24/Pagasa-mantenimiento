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
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
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

REM ===================================================================
REM  OJO, para quien edite este archivo: NO cambies NADA de lo que esta
REM  ARRIBA de "git pull". Al hacer pull este mismo archivo se reemplaza
REM  mientras se ejecuta, y Windows sigue leyendolo por posicion: si cambia
REM  el largo de lo de arriba, la version vieja que esta corriendo ejecuta
REM  renglones cortados. Lo que haya que cambiar va en
REM  servidor-actualizar-pasos.bat, que se lee completo despues del pull.
REM ===================================================================
call "%~dp0servidor-actualizar-pasos.bat"
goto :fin

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
