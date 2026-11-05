@echo off
REM ===================================================================
REM  Sistema Pagasa - pasos de la actualizacion DESPUES de traer el codigo
REM
REM  Lo llama servidor-actualizar.bat justo despues de "git pull" (no se
REM  corre solo). Aqui va todo lo que pueda cambiar de una version a otra:
REM  este archivo se lee completo y ya actualizado.
REM
REM  IMPORTANTE: usa "prisma migrate deploy", NUNCA "migrate dev".
REM ===================================================================

cd /d "%~dp0.."

REM Si el sistema ya iba por HTTPS, su proceso tambien escucha en el 3443.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 :3443" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

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
echo   Listo. El servidor se inicia solo. Si no esta
echo   instalado como tarea programada, se abre en su
echo   propia ventana ("Servidor Pagasa"): dejala abierta.
echo ==========================================
echo.
REM Si el servidor esta instalado como tarea programada (scripts\
REM servidor-instalar-arranque.bat), se levanta por esa tarea: asi sigue
REM prendido aunque se cierre esta ventana o la sesion de Windows. Si no hay
REM tarea, en otra ventana y sin esperarla: esta ventana termina aqui y la
REM siguiente actualizacion puede reemplazar estos archivos sin problema.
schtasks /Query /TN "Servidor Pagasa" >nul 2>&1
if errorlevel 1 goto :iniciar_en_ventana
echo   Iniciando con la tarea programada "Servidor Pagasa"...
schtasks /End /TN "Servidor Pagasa" >nul 2>&1
schtasks /Run /TN "Servidor Pagasa" >nul 2>&1
if not errorlevel 1 goto :iniciado
echo   No se pudo usar la tarea programada: se inicia en una ventana.
:iniciar_en_ventana
start "Servidor Pagasa" "%~dp0servidor-iniciar.bat"
:iniciado
timeout /t 5 /nobreak >nul
exit /b 0

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
exit /b 1
