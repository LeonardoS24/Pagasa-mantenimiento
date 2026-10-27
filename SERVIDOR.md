# Cómo dejar el servidor corriendo solo

Hoy el sistema se levanta a mano y **se cae cuando se cierra la ventana**. Esto
explica cómo dejarlo prendido de forma permanente, que se levante solo al
encender la computadora y siga aunque nadie tenga sesión abierta en Windows.

## Datos de esta instalación

| Dato | Valor |
|---|---|
| Aplicación | Next.js 14.2.35 |
| Node | v24.18.0 (`C:\Program Files\nodejs\node.exe`) |
| Carpeta del proyecto | `C:\Users\Leonardo Silvas\Documents\Claude` |
| Puerto | 3000 |
| Dirección en la red | `http://192.168.10.161:3000` |
| Base de datos | SQLite — `prisma\dev.db` (~0.7 MB) |
| Archivos subidos | `uploads\` (~507 MB) |
| Respaldos automáticos | `backups\` (~1 GB, se guardan los últimos 5, uno al día) |
| Variables de entorno | `.env` → `DATABASE_URL`, `SESSION_SECRET` |

## Antes de empezar: dos cosas que sí o sí

**1. Fijar la dirección IP.** Hoy la computadora tiene `192.168.10.161`, pero
esa dirección se la asigna el módem y **puede cambiar sola al reiniciar**. Si
cambia, a todos se les rompe el acceso. Hay que dejarla fija, de una de estas
dos formas:

- En el módem/router: reservar la IP para esa computadora (busca "DHCP
  reservation" o "IP estática" en su configuración).
- O en Windows: Configuración → Red e Internet → Propiedades de la conexión →
  Asignación de IP → Editar → Manual, y poner `192.168.10.161`.

**2. Abrir el puerto 3000 en el Firewall**, o solo esa computadora podrá
entrar. En PowerShell **como administrador**:

```powershell
New-NetFirewallRule -DisplayName "Pagasa Mantenimiento" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
```

> `-Profile Private` limita el acceso a la red local. No lo cambies a `Any`:
> el sistema va por HTTP sin cifrar (ver "Seguridad" abajo) y no debe quedar
> expuesto fuera de la red de la empresa.

## Montar el servidor (Programador de tareas de Windows)

Es la forma más simple: no hay que instalar nada, viene en Windows y sobrevive
a reinicios y a cerrar sesión.

### Paso 1 — Compilar

Una sola vez (y cada vez que se actualice el sistema):

```bash
npm run build
```

### Paso 2 — Crear el archivo de arranque

Crea `C:\Users\Leonardo Silvas\Documents\Claude\iniciar-servidor.bat` con:

```bat
@echo off
cd /d "C:\Users\Leonardo Silvas\Documents\Claude"
"C:\Program Files\nodejs\node.exe" scripts\servidor.mjs
```

(O apunta la tarea directo a `scripts\servidor-iniciar.bat`, que hace lo
mismo.)

### Paso 3 — Programar la tarea

Abre **Programador de tareas** → *Crear tarea…* (no "tarea básica"):

- **General**: ponle nombre `Servidor Pagasa`. Marca **"Ejecutar tanto si el
  usuario inició sesión como si no"** y **"Ejecutar con los privilegios más
  altos"**.
- **Desencadenadores** → Nuevo → *Al iniciar el sistema*.
- **Acciones** → Nueva → Iniciar un programa:
  - Programa: `C:\Users\Leonardo Silvas\Documents\Claude\iniciar-servidor.bat`
  - Iniciar en: `C:\Users\Leonardo Silvas\Documents\Claude`
- **Configuración**: marca *"Si la tarea falla, reiniciarla cada"* → 1 minuto,
  hasta 3 veces.

Te pedirá la contraseña de Windows (es lo que le permite correr sin sesión
abierta). Después, botón derecho en la tarea → **Ejecutar**, y comprueba desde
otra computadora que abre `http://192.168.10.161:3000`.

### Alternativa: NSSM

Si prefieres que aparezca como servicio de Windows de verdad (con su arranque,
paro y reinicio), usa [NSSM](https://nssm.cc). Es más limpio de administrar,
pero hay que descargar un programa extra. El Programador de tareas alcanza para
este caso.

## Operación diaria

**Actualizar el sistema después de un cambio:**

```bash
npm run build
```

…y reinicia la tarea (Programador de tareas → botón derecho → Reiniciar). El
`build` no interrumpe a nadie; el reinicio sí, unos segundos.

**Ver si está arriba:**

```bash
curl -s -o NUL -w "%{http_code}" http://localhost:3000/login
```

Debe contestar `200`.

**Si el puerto quedó ocupado** (por ejemplo, quedó un servidor viejo colgado):

```bash
netstat -ano | findstr :3000
```

…y termina ese PID desde el Administrador de tareas.

## Respaldos

Hay dos, y hacen cosas distintas:

1. **Respaldo en este equipo** (`backups\`): uno al día, base y archivos, se
   conservan los últimos 5. Sirve para deshacer un error, no para un disco
   dañado (vive en el mismo disco).
2. **Copia de seguridad servidor** (memoria USB): es la que protege si el disco
   del servidor falla.

### Configurar la Copia de seguridad servidor (una sola vez)

1. Conecta la memoria USB al servidor y déjala conectada.
2. Entra al sistema como administrador → **Panel de administración →
   Respaldos**.
3. En "Copia de seguridad servidor" aparece la lista de unidades: elige la
   memoria (por ejemplo `E:\`) y pulsa **Guardar unidad**.
4. Pulsa **Copiar ahora**. La primera vez copia todos los archivos (~500 MB,
   unos minutos). Después tarda segundos, porque solo copia lo nuevo.
5. Pulsa **Probar restauración**: debe decir "se puede restaurar".

Desde ahí se hace sola cada día. En la memoria queda la carpeta
`Copia de seguridad servidor` con `base\` (una copia de la base por día, las
últimas 30), `uploads\` (todos los archivos; ahí no se borra nada) y un
`LEEME.txt` con cómo restaurar. Si la memoria se desconecta, en Inicio el
administrador ve un aviso rojo a las 48 h.

**Restaurar** (solo si se perdió la base): doble clic en
`scripts\servidor-restaurar.bat`, arrastra el `.db` más reciente de la memoria y
escribe SI. Guarda la base actual en `backups\antes-de-restaurar\` antes de
tocar nada.

Recomendación: cada mes, cambia la memoria por otra y guarda la anterior fuera
de la oficina. Así un robo o un incendio no se lleva las dos.

**Lo que la copia NO lleva, a propósito:** el `.env` (tiene `SESSION_SECRET`,
la llave con la que se cifra la contraseña del correo) y `certificados\` (la
llave de HTTPS). Son llaves: no deben ir en una memoria que se puede perder.
Guarda una copia del `.env` en un lugar seguro aparte (una USB guardada bajo
llave, o impreso en sobre cerrado). Si se pierde, el sistema se recupera igual
pero hay que volver a capturar la contraseña del correo y todos inician sesión
de nuevo.

## HTTPS (cifrar las contraseñas en la red)

Por HTTP, el usuario y la contraseña viajan legibles por la red local. Con
HTTPS viajan cifrados. Es opcional y se activa así:

1. En el servidor: doble clic en `scripts\servidor-activar-https.bat`. Crea la
   carpeta `certificados\` (no se sube a git: tiene llaves privadas).
2. **En cada computadora y celular** hay que instalar una vez
   `certificados\pagasa-ca.crt` (cópialo por USB o compártelo):
   - **Windows**: doble clic en el archivo → Instalar certificado → Equipo
     local → "Colocar todos los certificados en el siguiente almacén" →
     **Entidades de certificación raíz de confianza** → Finalizar. Cierra y
     abre el navegador.
   - **Android**: Ajustes → Seguridad → Cifrado y credenciales → Instalar un
     certificado → Certificado de CA → elige el archivo.
   - **iPhone**: abre el archivo → Ajustes → Perfil descargado → Instalar;
     luego Ajustes → General → Información → Ajustes de confianza de
     certificados → activar "Pagasa Sistema de Mantenimiento CA".
3. Reinicia el servidor (`servidor-iniciar.bat`). Ahora la dirección es
   `https://IP:3443`; quien entre por `http://IP:3000` (o con un QR viejo) es
   redirigido solo.
4. En **Administración → Reportes por correo**, cambia la "Dirección del
   sistema" a `https://IP:3443` (para los correos y los QR nuevos).
5. Abre el puerto 3443 en el firewall, igual que el 3000.

Si cambia la IP del servidor, vuelve a correr el paso 1: el certificado se
rehace, pero la autoridad (`pagasa-ca.crt`) es la misma y no hay que
reinstalar nada en los equipos. Para quitar HTTPS: borra `certificados\` y
reinicia.

Equipos que todavía no tienen el certificado instalado ven "la conexión no es
privada": pueden entrar con "Avanzado → Continuar", pero lo correcto es
instalarlo.

## Si algo falla

Doble clic en `scripts\servidor-diagnostico.bat`: crea `backups\diagnostico.txt`
con versiones, estado de git, migraciones, puertos, espacio y el final del
último build (sin contraseñas ni el contenido de `.env`). Ese archivo es lo que
hay que mandar. Si la actualización falla al compilar, el `.bat` ya reintenta
una vez borrando `.next` y deja el error completo en `backups\ultimo-build.log`.

## Seguridad

- La cookie de sesión va cifrada (`secure`) solo cuando el sistema se sirve
  por HTTPS; `scripts\servidor.mjs` lo hace solo. No pongas
  `COOKIE_SECURE=true` a mano sirviendo por HTTP: **nadie podría iniciar
  sesión**.
- `SESSION_SECRET` del `.env` es lo que firma las sesiones: no se comparte y no
  se sube a ningún lado. Si se cambia, se cierran todas las sesiones abiertas.
- No expongas el puerto 3000 a internet. Para entrar desde fuera, lo correcto
  es una VPN a la red de la empresa.

## Qué equipo hace falta

### Lo que de verdad consume (medido, no estimado)

| Recurso | Consumo real hoy |
|---|---|
| RAM | ~150–215 MB (los procesos de node) |
| CPU | Prácticamente nada en reposo; picos cortos al abrir pantallas |
| Disco | ~1.6 GB en total: `uploads\` 507 MB + `backups\` 1 GB + la base 0.7 MB |

La computadora actual (i7-14650HX, 15.7 GB de RAM, 24 hilos) le queda **enorme**.
Este sistema no necesita potencia: necesita estar **prendido siempre** y tener
**disco de sobra**, porque lo que crece son los archivos que la gente sube.

### Requisitos mínimos y recomendados

| | Mínimo | Recomendado |
|---|---|---|
| RAM | 4 GB | 8 GB |
| CPU | 2 núcleos | 4 núcleos |
| Disco | 128 GB SSD | 512 GB SSD |
| Sistema | Windows 10/11 o Linux | Igual |

Con 8 GB y 512 GB vas holgado por años.

### Las opciones, de más a menos recomendable para tu caso

**1. Mini-PC dedicada — es la que yo elegiría.**
Una mini-PC (tipo Intel N100/N150, 8–16 GB, SSD 512 GB) ronda los **$3,000 a
$6,000 MXN**. Gasta como un foco (~10 W), es silenciosa, cabe en cualquier
rincón y puede quedarse encendida todo el año. Sobra para esta carga y le
quita el sistema de encima a la computadora de alguien.

**2. Reutilizar una PC de oficina que ya tengas.**
Costo cero. La condición es que sea **dedicada**: si es la computadora de
alguien, tarde o temprano la apaga, la reinicia o la desconecta, y el sistema
se cae para todos.

**3. NAS con Docker (Synology y parecidos).**
Entre **$8,000 y $15,000 MXN** más discos. Cuesta más y tiene su curva de
aprendizaje, pero resuelve de un golpe el problema de los respaldos: con dos
discos en espejo, si uno falla no pierdes nada. Tiene sentido si además
quieres un lugar central para archivos de la empresa.

**4. Servidor de verdad (torre o rack, Xeon, discos redundantes).**
De **$25,000 MXN para arriba**. Para esta aplicación es desperdicio: usarías el
1 % de su capacidad. Solo se justifica si vas a montar ahí varias cosas más de
la empresa.

**5. Un VPS en la nube (servidor Linux rentado).**
Unos **$100–200 MXN al mes**. Técnicamente funciona, pero cámbiale el modelo al
sistema: hoy vive en tu red y nadie de fuera lo alcanza. En la nube tendrías
que ponerle HTTPS, un dominio y una VPN o dejarlo expuesto a internet. Además,
**si se cae el internet de la planta, nadie puede trabajar** — hoy eso no pasa
porque todo es local. Solo lo consideraría si necesitas entrar desde varias
ciudades sin VPN.

### Una advertencia sobre "subirlo a una página"

Las plataformas tipo **Vercel o Netlify no sirven para este sistema tal como
está**, aunque sea una app de Next.js. Ahí los servidores no guardan archivos:
se borran en cada despliegue. Y este sistema depende de tres cosas que viven en
disco:

- la base de datos, que es un archivo (`prisma\dev.db`),
- los documentos y fotos que sube la gente (`uploads\`, 507 MB),
- los respaldos automáticos (`backups\`).

En una plataforma de esas, **se perderían la base y los archivos**. Para poder
usarlas habría que migrar la base a PostgreSQL y los archivos a un
almacenamiento tipo S3. Es un proyecto aparte, no un ajuste de configuración.
Un VPS (opción 5) sí funciona porque tiene disco de verdad.

### Dos accesorios que sí valen la pena

- **No-break (UPS), ~$1,500–3,000 MXN.** Es lo más importante después del
  equipo. Un apagón de golpe puede **corromper la base de datos** de SQLite y
  dejarla inservible. Con un no-break el servidor se apaga ordenado.
- **Un disco externo para los respaldos, ~$1,000–2,000 MXN.** Hoy los respaldos
  están en el mismo disco que el sistema: si ese disco muere, se pierden los
  dos juntos y no sirve de nada tenerlos.

> Los precios son aproximados y de referencia; conviene verificarlos al momento
> de comprar.

## Sobre la base de datos

Es SQLite: un archivo. Aguanta bien a un grupo pequeño trabajando al mismo
tiempo, pero **las escrituras se hacen de una en una**. Con el uso actual va
sobrado; si algún día entran muchas personas a capturar a la vez y se siente
lento, ahí tocaría cambiar a PostgreSQL (Prisma lo permite cambiando el
`provider`, pero es una migración aparte, no un cambio de un renglón).
