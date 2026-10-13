# Cómo se sirve el sistema y cómo se le hacen cambios

Dos computadoras, con papeles distintos:

| | **SERVIDOR** (la que siempre está prendida) | **DESARROLLO** (la laptop de Leonardo) |
|---|---|---|
| Para qué | Que el equipo entre y capture | Hacer y probar cambios |
| Qué datos tiene | **Los reales** | Una copia para probar |
| Quién entra | Todos, por la red | Solo Leonardo |
| Cómo se levanta | `scripts\servidor-iniciar.bat` | `npm run dev` |

La regla que ordena todo: **los datos reales viven solo en el SERVIDOR.** En
desarrollo se trabaja siempre con una copia, para que una prueba nunca pueda
dañar la información de la empresa.

## Instalación (una sola vez, en el SERVIDOR)

1. Instalar **Node.js** (versión 24 o más nueva) y **Git**.
2. Traer el código (ver *Cómo viaja el código* al final).
3. Copiar a mano estas tres cosas desde la laptop — **no viajan con el
   código, a propósito**, porque son datos reales y no código:

   | Qué | De dónde | Tamaño |
   |---|---|---|
   | La base de datos | `prisma\dev.db` | 868 KB |
   | Los archivos subidos | `uploads\` completa | 507 MB |
   | Las claves | `.env` | 2 líneas |

   La carpeta `backups\` **no** hace falta copiarla (son 2.5 GB de respaldos
   históricos; el servidor genera los suyos).

4. En esa carpeta, correr una vez:
   ```
   npm install
   npx prisma migrate deploy
   npm run build
   ```
5. Doble clic en `scripts\servidor-iniciar.bat`. La ventana muestra la
   dirección que hay que repartirle al equipo (`http://192.168.x.x:3000`).

> **Ojo con el firewall:** la primera vez Windows va a preguntar si permite
> que Node.js reciba conexiones. Hay que decir que **sí**, para redes
> privadas. Si no, nadie más va a poder entrar.

> **Que sobreviva un reinicio:** conviene dejar `servidor-iniciar.bat` en
> el Programador de tareas de Windows, con la opción "Al iniciar el equipo".
> Si no, cada vez que se reinicie esa computadora alguien tiene que ir a
> darle doble clic.

## El día a día

**Cuando hay cambios listos:**

1. En la laptop, los cambios se guardan y se suben (`git push`).
2. En el SERVIDOR: doble clic en `scripts\servidor-actualizar.bat`.

Ese archivo hace todo en orden y se detiene si algo falla: respalda la base,
trae el código, aplica los cambios de estructura, compila y vuelve a
levantar el servidor. Toma un par de minutos, y **durante ese rato nadie
puede entrar** — conviene hacerlo fuera de horario o avisando antes.

Las sesiones abiertas **no se pierden** con el reinicio: nadie tiene que
volver a iniciar sesión.

**Para probar un cambio en la laptop antes de mandarlo:**

```bash
npm run dev
```

Levanta el sistema en `http://localhost:3000` con los datos de la copia, y
los cambios de código se ven al instante sin tener que compilar.

## Llevar datos nuevos (Excel, carpetas de documentos)

Lo que no es código (un Excel de levantamiento, la carpeta de una ciudad nueva
con sus PDF) no viaja por git. Se lleva en USB y se importa en el servidor:

1. Copiar a la USB el Excel y/o la carpeta.
2. En el servidor: `scripts\servidor-actualizar.bat` (trae el código nuevo).
3. En el servidor: doble clic en `scripts\servidor-importar-datos.bat`. Busca
   la USB sola, respalda la base, **simula y muestra el resumen**, guarda solo si
   se escribe SI, verifica y vuelve a levantar el servidor. Cada paso queda
   registrado en `backups\antes-de-importar\`.

Los scripts de importación (`scripts/importar-*.mts`, `scripts/crear-*.mts`)
solo llenan lo que falta y nunca pisan lo capturado, así que se pueden repetir.

## Traer datos frescos a la laptop

Para revisar algo contra la información real (o antes de un cambio
delicado), se copia la base del SERVIDOR a la laptop:

1. En el servidor, entrar a `/admin/respaldos` y generar un respaldo.
2. Copiar ese archivo a la laptop, a `prisma\dev.db`.

Son menos de 1 MB, es cuestión de segundos. Es de **una sola dirección**:
del servidor a la laptop, nunca al revés. Mandar la base de la laptop al
servidor borraría todo lo que el equipo capturó mientras tanto.

## Reglas que no se rompen

1. **La base de la laptop nunca se copia al servidor.** Solo al revés.
2. **En el servidor jamás se corre `prisma migrate dev`** — puede reiniciar
   la base. Solo `migrate deploy`, que es lo que usa el `.bat`.
3. **Antes de un cambio de estructura, respaldo.** El `.bat` ya lo hace
   solo, pero si se hace algo a mano, primero el respaldo.
4. **El servidor se detiene antes de actualizar.** SQLite bloquea el archivo
   de la base; con el servidor encendido la migración falla a medias.

## Cómo viaja el código

El código se mueve con **git**, que además guarda el historial completo de
cambios. Hace falta un lugar de donde las dos computadoras jalen y empujen;
hoy no hay ninguno configurado, así que el código existe **únicamente en la
laptop**. Eso hay que resolverlo: si esa máquina falla, se pierde todo el
sistema (la base sí tiene respaldos, el código no).

Dos formas de resolverlo, según lo que convenga:

- **Carpeta compartida en la red.** Se crea un repositorio en una carpeta
  compartida de la red interna y las dos computadoras lo usan. No necesita
  internet ni cuentas, y de paso deja una segunda copia del código.
- **Repositorio privado en GitHub.** Necesita cuenta e internet, pero la
  copia queda fuera de la oficina — protege también contra un incendio, un
  robo o que se descompongan las dos computadoras.

Una vez configurado, el flujo es siempre el mismo: `git push` en la laptop
y doble clic en `servidor-actualizar.bat` en el servidor.
