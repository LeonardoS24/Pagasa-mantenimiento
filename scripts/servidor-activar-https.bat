@echo off
setlocal
REM ===================================================================
REM  Sistema Pagasa - ACTIVAR HTTPS
REM
REM  Crea los certificados (certificados\) para que el sistema se sirva
REM  cifrado: con HTTPS las contrasenas ya no viajan legibles por la red.
REM  Despues de esto el servidor atiende en https://IP:3443 y el puerto
REM  3000 redirige solo (los codigos QR viejos siguen sirviendo).
REM
REM  Si cambia la IP del servidor, vuelve a correr este archivo: el
REM  certificado se rehace, pero la autoridad (pagasa-ca.crt) se conserva y
REM  no hay que reinstalarla en los equipos.
REM
REM  Para quitar HTTPS: borra la carpeta certificados\ y reinicia.
REM ===================================================================

cd /d "%~dp0.."

echo Creando certificados...
node scripts\crear-certificado-https.mjs %*
if errorlevel 1 goto :error

echo.
echo ==========================================================
echo   LISTO. Falta un paso en CADA computadora y celular:
echo   instalar certificados\pagasa-ca.crt como "entidad de
echo   certificacion raiz de confianza" (ver SERVIDOR.md, HTTPS).
echo   Sin eso el navegador avisa "la conexion no es privada".
echo.
echo   Luego reinicia el servidor (servidor-iniciar.bat) y en
echo   Administracion ^> Reportes cambia la "Direccion del sistema"
echo   a https://IP-DEL-SERVIDOR:3443
echo ==========================================================
goto :fin

:error
echo.
echo HUBO UN ERROR creando los certificados. Avisale a Leonardo.

:fin
pause
