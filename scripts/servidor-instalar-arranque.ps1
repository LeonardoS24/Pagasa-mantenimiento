# ===================================================================
#  Sistema Pagasa - DEJAR EL SERVIDOR PRENDIDO SOLO
#
#  Crea la tarea programada de Windows "Servidor Pagasa": el sistema se
#  levanta solo al encender la computadora, aunque nadie inicie sesion,
#  y se vuelve a levantar si se cae. Hace lo mismo que el paso a paso
#  de SERVIDOR.md, sin hacerlo a mano.
#
#  Se corre en la computadora que hace de servidor, con doble clic en
#  scripts\servidor-instalar-arranque.bat (pide permiso de administrador).
#
#    -SoloVerificar  revisa todo y dice que haria, sin cambiar nada
#    -Quitar         borra la tarea (el sistema deja de arrancar solo)
#
#  Se queda corriendo con TU usuario de Windows, no como SYSTEM: un
#  servidor web no debe tener permisos de toda la computadora. Por eso
#  pide la contrasena de Windows una vez (la guarda Windows, no el
#  sistema ni este archivo).
#
#  Sin acentos a proposito: PowerShell 5 lee mal los acentos de un
#  archivo sin marca de codificacion.
# ===================================================================
param(
  [switch]$Quitar,
  [switch]$SoloVerificar
)

$ErrorActionPreference = "Stop"
$NombreTarea = "Servidor Pagasa"
$NombreRegla = "Pagasa Mantenimiento"
$Raiz = Split-Path -Parent $PSScriptRoot
$Bat = Join-Path $PSScriptRoot "servidor-iniciar.bat"

function Titulo($texto) { Write-Host ""; Write-Host "== $texto" -ForegroundColor Cyan }
function Bien($texto) { Write-Host "  [OK] $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "  [!]  $texto" -ForegroundColor Yellow }
function Falla($texto) { Write-Host "  [X]  $texto" -ForegroundColor Red }

function EsAdministrador {
  $actual = [Security.Principal.WindowsIdentity]::GetCurrent()
  return ([Security.Principal.WindowsPrincipal]$actual).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host ""
Write-Host "Sistema Pagasa - arranque automatico del servidor" -ForegroundColor White
Write-Host "Carpeta del sistema: $Raiz"

# ---------------------------------------------------------------
# Quitar la tarea
# ---------------------------------------------------------------
if ($Quitar) {
  if (-not (EsAdministrador)) { Falla "Hace falta abrirlo como administrador."; exit 1 }
  $existe = Get-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
  if (-not $existe) { Aviso "La tarea '$NombreTarea' no existe; no hay nada que quitar."; exit 0 }
  Stop-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false
  Bien "Tarea '$NombreTarea' eliminada. El sistema ya no arranca solo (si esta prendido ahora, sigue prendido hasta apagarlo)."
  exit 0
}

# ---------------------------------------------------------------
# Revisiones (no cambian nada)
# ---------------------------------------------------------------
$problemas = 0

Titulo "Revisando esta computadora"

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) { Bien "Node.js: $($node.Source)" } else { Falla "No se encontro Node.js en el PATH."; $problemas++ }

if (Test-Path $Bat) { Bien "Script de arranque: $Bat" } else { Falla "No existe $Bat"; $problemas++ }

if (Test-Path (Join-Path $Raiz ".next\BUILD_ID")) {
  Bien "El sistema esta compilado (.next)."
} else {
  Falla "Falta compilar el sistema. En la carpeta del sistema corre:  npm run build"
  $problemas++
}

if (Test-Path (Join-Path $Raiz ".env")) { Bien "Existe el archivo .env." } else { Falla "Falta el archivo .env (DATABASE_URL y SESSION_SECRET)."; $problemas++ }

$usuario = "$env:USERDOMAIN\$env:USERNAME"
Bien "La tarea correra con el usuario: $usuario"

# La IP tiene que ser fija: si cambia al reiniciar, a todos se les rompe el acceso.
$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" })
foreach ($ip in $ips) {
  if ($ip.PrefixOrigin -eq "Dhcp") {
    Aviso "La IP $($ip.IPAddress) la asigna el modem (DHCP) y puede cambiar al reiniciar. Reservala en el modem o ponla fija en Windows."
  } else {
    Bien "IP fija: $($ip.IPAddress)"
  }
}

$yaHayTarea = Get-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
if ($yaHayTarea) { Aviso "Ya existe la tarea '$NombreTarea': se reemplaza (no se duplica)." }

$regla = Get-NetFirewallRule -DisplayName $NombreRegla -ErrorAction SilentlyContinue
if ($regla) { Bien "Ya existe la regla de firewall '$NombreRegla'." } else { Aviso "Falta la regla de firewall (puertos 3000 y 3443, solo red privada): se crea." }

$escuchando = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($escuchando) { Aviso "Ahora mismo ya hay un servidor prendido en el puerto 3000 (una ventana abierta, por ejemplo)." }

if ($SoloVerificar) {
  Titulo "Resumen"
  if ($problemas -gt 0) { Falla "$problemas problema(s) por resolver antes de instalar." } else { Bien "Todo listo. Corre el instalador sin -SoloVerificar para crear la tarea." }
  exit $problemas
}

# ---------------------------------------------------------------
# Instalar
# ---------------------------------------------------------------
if ($problemas -gt 0) { Write-Host ""; Falla "Resuelve lo marcado con [X] y vuelve a correr esto."; exit 1 }
if (-not (EsAdministrador)) { Write-Host ""; Falla "Hace falta abrirlo como administrador (usa servidor-instalar-arranque.bat)."; exit 1 }

Write-Host ""
Write-Host "Se va a:" -ForegroundColor White
Write-Host "  1. Crear la tarea '$NombreTarea': arranca con Windows (30 s despues de encender), sin necesidad de sesion abierta."
if (-not $regla) { Write-Host "  2. Abrir los puertos 3000 y 3443 en el firewall, solo en red privada." }
Write-Host ""
$ok = Read-Host "Escribe SI para continuar"
if ($ok.Trim().ToUpper() -ne "SI") { Aviso "Cancelado. No se cambio nada."; exit 0 }

Write-Host ""
$clave = Read-Host "Contrasena de Windows de $usuario (para que corra sin sesion abierta)" -AsSecureString
$claveTexto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($clave))
if ([string]::IsNullOrEmpty($claveTexto)) {
  Falla "Windows no deja correr tareas sin sesion con una cuenta sin contrasena. Ponle una contrasena a este usuario y vuelve a intentar."
  exit 1
}

try {
  # cmd /c con "< NUL": cuando el servidor se detiene, el "pause" del script no
  # se queda esperando una tecla que nadie va a presionar (si se quedara, la
  # tarea seguiria "en ejecucion" y no se podria volver a iniciar).
  $accion = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ('/c ""{0}" < NUL"' -f $Bat) -WorkingDirectory $Raiz
  $disparador = New-ScheduledTaskTrigger -AtStartup
  $disparador.Delay = "PT30S"
  $ajustes = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador -Settings $ajustes `
    -User $usuario -Password $claveTexto -RunLevel Limited -Force `
    -Description "Sistema Integral de Mantenimiento Pagasa: arranca el servidor con Windows." | Out-Null
} catch {
  Write-Host ""
  Falla "No se pudo crear la tarea: $($_.Exception.Message)"
  Write-Host "     Casi siempre es la contrasena de Windows mal escrita." -ForegroundColor Yellow
  exit 1
} finally {
  $claveTexto = $null
}
Bien "Tarea '$NombreTarea' creada."

if (-not $regla) {
  New-NetFirewallRule -DisplayName $NombreRegla -Direction Inbound -LocalPort 3000, 3443 -Protocol TCP -Action Allow -Profile Private | Out-Null
  Bien "Firewall: puertos 3000 y 3443 abiertos en red privada."
}

# ---------------------------------------------------------------
# Prender ahora, si se puede
# ---------------------------------------------------------------
Titulo "Probando"
if ($escuchando) {
  Aviso "No se inicio ahora porque ya hay un servidor prendido. Para pasarlo a la tarea: cierra su ventana y corre"
  Write-Host "       Start-ScheduledTask -TaskName '$NombreTarea'" -ForegroundColor Yellow
  Write-Host "     (o reinicia la computadora)."
} else {
  Start-ScheduledTask -TaskName $NombreTarea
  $arriba = $false
  for ($i = 0; $i -lt 20 -and -not $arriba; $i++) {
    Start-Sleep -Seconds 2
    try { $arriba = ((Invoke-WebRequest -Uri "http://127.0.0.1:3000/login" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) } catch { $arriba = $false }
  }
  if ($arriba) { Bien "El sistema responde en http://127.0.0.1:3000" } else { Falla "La tarea se inicio pero el sistema no responde todavia. Revisa logs\ y corre scripts\servidor-diagnostico.bat." }
}

Titulo "Listo"
Write-Host "  - Al actualizar con servidor-actualizar.bat, el sistema se reinicia por esta tarea."
Write-Host "  - Ver si esta corriendo:   Get-ScheduledTask -TaskName '$NombreTarea' | Get-ScheduledTaskInfo"
Write-Host "  - Quitar el arranque automatico:   scripts\servidor-instalar-arranque.bat -Quitar"
Write-Host "  - Si cambias la contrasena de Windows, vuelve a correr este instalador (la tarea guarda la anterior)."
Write-Host ""
