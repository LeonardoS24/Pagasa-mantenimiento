# Acceso por internet para todas las plazas

Esta guía deja el sistema **en la misma computadora de siempre** (el servidor de
la empresa) y permite que las demás ciudades entren desde su celular, laptop o
computadora, **con solo abrir una dirección en el navegador**. No hay que
instalar nada en los equipos de las plazas.

Se hace con un **túnel de Cloudflare**: un programa pequeño (`cloudflared`) que
corre en el servidor y abre una conexión *de salida* hacia Cloudflare. Los
usuarios entran a `https://mantenimiento.tudominio.com`, Cloudflare les pone el
HTTPS y les pasa la petición por el túnel hasta el servidor. **No se abre ningún
puerto en el router ni hace falta IP pública.**

```
Celular / laptop de una plaza
        │  https://mantenimiento.tudominio.com
        ▼
   Cloudflare  (HTTPS + acceso previo por correo, opcional)
        │  túnel cifrado (conexión que el servidor abre hacia afuera)
        ▼
 Servidor de la empresa  (cloudflared  →  http://localhost:3000)
```

La red local sigue funcionando igual: quien esté en la oficina puede seguir
entrando por `http://192.168.10.161:3000`.

---

## 0. Antes de empezar: lo que hay que decidir y tener

| Cosa | Detalle |
|---|---|
| **Autorización** | La información de la empresa quedará accesible desde internet (protegida con contraseña, doble verificación y, si se quiere, acceso previo por correo). Alguien de Grupo Pagasa debe estar de acuerdo. |
| **Cuenta de Cloudflare** | Gratis. Créala con un **correo de la empresa**, no personal, para que no se pierda cuando cambie la persona. |
| **Un dominio** | Hace falta uno para el túnel. Lo más limpio es **un dominio aparte solo para este sistema** (unos 10–12 USD al año, se compra desde la propia cuenta de Cloudflare). No conviene pasar el dominio principal de la empresa a Cloudflare sin que quien lo administra lo revise: cambia dónde se administra el DNS y podría afectar el correo y el sitio web. |
| **Servidor siempre encendido** | La computadora no debe suspenderse ni apagarse, y conviene que tenga no-break. Si se apaga, nadie entra. |
| **Internet de la oficina del servidor** | Si falla, las demás plazas pierden acceso (quien esté en esa red sigue entrando). |

> El acceso previo por correo (Cloudflare Access) es gratis hasta 50 usuarios;
> a partir de ahí es de paga. Revisa en la página de Cloudflare sus condiciones
> actuales para uso en empresas antes de depender de él.

---

## 1. Preparar el sistema (en el servidor)

1. **Actualiza el sistema** a esta versión con `scripts\servidor-actualizar.bat`.
   Aplica la migración de la doble verificación (campos nuevos en la tabla de
   usuarios; no toca ningún dato).
2. Abre el archivo `.env` de la carpeta del sistema y agrega estas dos líneas:

   ```
   CONFIAR_TUNEL=cloudflare
   EXIGIR_2FA_ADMIN=true
   ```

   - `CONFIAR_TUNEL=cloudflare`: el sistema toma de Cloudflare la **IP real** de
     cada persona y sabe que la conexión llegó por HTTPS. Solo lo cree cuando la
     petición viene de la propia computadora (donde corre `cloudflared`); una
     computadora de la red local no puede hacerse pasar por el túnel.
   - `EXIGIR_2FA_ADMIN=true`: obliga a los administradores a activar la doble
     verificación. Mientras no la activen, solo pueden entrar a esa pantalla.

3. **Reinicia el servidor** (cierra su ventana y vuelve a abrirlo con
   `scripts\servidor-iniciar.bat`, o corre otra vez el actualizador).
4. **Cada administrador activa su doble verificación** (al iniciar sesión el
   sistema se lo pide): instala una aplicación como Google Authenticator o
   Microsoft Authenticator, escanea el QR y escribe el código. **Guarda los 8
   códigos de recuperación** (solo se muestran una vez): sirven si se pierde el
   teléfono.
5. Cambia la contraseña de cualquier cuenta que siga con una temporal o débil
   (el sistema ya exige 10 caracteres, letras y números).

---

## 2. Crear el túnel en Cloudflare

Los nombres de los menús de Cloudflare cambian de vez en cuando; si algo no
coincide, busca «Cloudflare Tunnel» en su documentación oficial.

1. Entra a Cloudflare con la cuenta de la empresa y **agrega el dominio**
   (o cómpralo ahí mismo). Sigue sus pasos hasta que el dominio aparezca activo.
2. Ve a **Zero Trust → Networks → Tunnels → Create a tunnel** → tipo
   **Cloudflared** → ponle de nombre `servidor-pagasa`.
3. Elige **Windows** y sigue lo que indica: descargar `cloudflared` e instalarlo
   como **servicio** con el comando que te muestra (lleva un *token* largo; es
   una llave, **no la compartas ni la subas a ningún lado**). Ejecútalo en una
   ventana de comandos **como administrador** en el servidor. Como servicio, el
   túnel arranca solo cuando se enciende la computadora.
4. En **Public hostname** agrega:
   - Subdominio: `mantenimiento` (o el que prefieras) y tu dominio.
   - Servicio: **HTTP**, URL: `localhost:3000`.
   - No cambies el encabezado `Host` (déjalo como viene): el sistema lo necesita
     igual al de la dirección pública.
5. Guarda. En un minuto `https://mantenimiento.tudominio.com` debe abrir la
   pantalla de inicio de sesión del sistema.

---

## 3. Acceso previo por correo (recomendado)

Cloudflare Access pide un código al correo de la persona **antes** de mostrar el
sistema. Solo entran los correos que tú autorices; los demás ni ven el login.

1. En **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Pon el mismo subdominio y dominio del paso 2.
3. Crea una política **Allow** con la lista de correos (o un dominio de correo
   completo, como `@grupopagasa.com`) que pueden entrar.
4. Como método de acceso deja **One-time PIN** (código por correo).

Con esto cada persona pasa **tres** cosas: correo autorizado → usuario y
contraseña del sistema → (administradores) código del teléfono.

---

## 4. Que el sistema use la dirección nueva

1. Entra al sistema como administrador, **Administración → Reportes por correo**,
   y en **Dirección del sistema** pon `https://mantenimiento.tudominio.com`
   (para que los correos y los códigos QR nuevos abran por internet).
2. Los códigos QR ya impresos con la IP vieja siguen funcionando dentro de la
   red de la empresa. Los de las plazas hay que volverlos a imprimir.

---

## 5. Probar que quedó bien

Desde un **celular con datos móviles** (sin la wifi de la empresa):

- [ ] Abre `https://mantenimiento.tudominio.com` → pide el correo (si activaste Access).
- [ ] Inicia sesión con un usuario de prueba → entra.
- [ ] Con un administrador → pide el código del teléfono.
- [ ] En **Administración → Bitácora de acceso**, el inicio de sesión sale con la **IP real** del celular (no `127.0.0.1`).
- [ ] Desde la oficina, `http://192.168.10.161:3000` sigue funcionando.

---

## 6. Qué hacer si…

| Situación | Qué hacer |
|---|---|
| **Quieres cerrar el acceso por internet ya** | En el servidor, detén el servicio *Cloudflared* (Servicios de Windows) o borra el túnel en Cloudflare. La red local sigue igual. |
| **Alguien perdió el teléfono** | Que entre con un **código de recuperación**. Si también los perdió, otro administrador la restablece en su ficha de usuario (**Administración → Usuarios**). |
| **El único administrador perdió todo** | En el servidor: `node scripts\desactivar-2fa.mjs nombre_de_usuario` (hay que estar físicamente en el servidor; no se puede hacer desde internet). |
| **Se apagó el servidor** | Al encenderlo, el sistema y el túnel arrancan solos si están instalados como servicio y con `scripts\servidor-instalar-arranque.bat`. |
| **Sospechas de un acceso raro** | **Administración → Bitácora de acceso** muestra intentos fallidos, bloqueos y la IP de cada uno. Cierra sesiones desde ahí y cambia la contraseña. |

## 7. Lo que NO hay que hacer

- **No abras el puerto 3000 ni el 3443 en el router.** Todo entra por el túnel.
- No compartas el *token* del túnel ni el archivo `.env`.
- No pongas `COOKIE_SECURE=true` a mano: el sistema marca la cookie como segura
  solo cuando la petición llegó por HTTPS (túnel o HTTPS propio), y así sigue
  funcionando por `http://192.168.10.161:3000` en la oficina.
- No quites la doble verificación a los administradores para «agilizar»: es la
  protección principal si alguien adivina una contraseña.

## 8. Costos

| Concepto | Costo |
|---|---|
| Túnel de Cloudflare | $0 |
| Acceso previo por correo | $0 hasta 50 usuarios (revisar condiciones de uso empresarial) |
| Dominio | unos 10–12 USD al año |
| Luz y no-break del servidor | los de siempre |
