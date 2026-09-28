# AR Creaciones — Ariana articulada · v2

## Probar en Windows

1. Descomprimí el ZIP completo.
2. Abrí la carpeta `arcreaciones-main`.
3. Hacé doble clic en **INICIAR.bat**. Requiere Python 3 instalado.
4. Se abre la web en el navegador. Dejá abierta la ventana de consola mientras la probás.

También podés ejecutar, desde esa carpeta:

```bash
python probar.py
```

O usar el servidor de tu editor (por ejemplo, Live Server). No abras el HTML mediante `file://`: el navegador puede bloquear las texturas WebGL de los archivos locales y mostrar solamente la imagen de respaldo.

## Qué probar

- Mové el cursor de un lado al otro de la portada: los iris miran primero y la cabeza acompaña con suavidad.
- El cuello, el torso, el hombro, el codo y la muñeca tienen influencias diferentes. La cintura queda anclada.
- El cabello tiene un pequeño retraso; la respiración es suave y el parpadeo usa intervalos variables.
- Tocá a Ariana o usá **Saludar** para activar una reacción de mano y un guiño.
- Pasá por los botones de la portada o enfocalos con Tab: Ariana orienta su atención hacia ellos.
- **Pausar** detiene el personaje y lo devuelve a su posición neutra; **Activar movimiento** lo reanuda.
- En el celular, un toque saluda y el movimiento del dedo sobre el personaje orienta la mirada sin bloquear el desplazamiento vertical.

## Ver el rig y las capas

Agregá `?rig=1` al final de la dirección local. Por ejemplo:

```text
http://localhost:8000/?rig=1
```

Aparece un inspector que permite ocultar cada pieza, ver las articulaciones y fijar la mirada a izquierda, centro o derecha. Ese panel sólo aparece si pedís ese modo en la URL.

## Archivos

| Archivo | Función |
| --- | --- |
| `index.html` | Landing original con la nueva escena y sus controles. |
| `style.css` | Diseño general de la web. |
| `interaction.js` | Microinteracciones de las tarjetas. |
| `assets/ariana/rig.js` | Motor de capas, malla, articulaciones, mirada, parpadeo y estados. |
| `assets/ariana/rig-config.js` | Puntos de giro, límites, máscaras y posición de los ojos. |
| `assets/ariana/rig.css` | Tamaño, adaptación móvil y controles del personaje. |
| `assets/ariana/source.webp` | Ilustración original, referencia de los iris y respaldo. |
| `assets/ariana/layers/*.png` | Ocho capas transparentes independientes, cargadas por el motor. |

Las capas PNG son: `torso`, `head`, `hair-back`, `hair-front-left`, `hair-front-right`, `upper-arm`, `forearm` y `hand`. Comparten un lienzo de 900 × 1125 píxeles. Mantené ese lienzo y la ubicación de cada pieza si las editás. Los ojos se renderizan en dos superficies adicionales, con el iris original, límites de mirada y párpados controlados por código.

## Cómo está construido

Es un **rig 2D por capas y malla deformable en WebGL**, programado para esta ilustración. Los vértices mezclan las influencias de los huesos en cuello, hombro, codo y muñeca. Las piezas comparten coordenadas en las uniones; la rotación conserva la continuidad de la ilustración. Las texturas se extraen del arte original, sin regenerar la identidad de Ariana. No se regeneró la ilustración en esta actualización.

Los movimientos están limitados a ángulos pequeños. Es adecuado para mirar, respirar, inclinarse y reaccionar con la mano. No contiene perspectivas laterales nuevas, una boca para hablar ni zonas ocultas reconstruidas para giros amplios. Esas poses necesitarían arte adicional y ajustes del rig.

El motor usa los PNG incluidos. Las máscaras de `rig-config.js` sirven como respaldo para reconstruir las piezas desde `source.webp` si falta alguna. Para modificar el arte, editá los PNG; para cambiar el movimiento, ajustá `limits`, `bones` y los pesos de `deform()`.

### Integración desde otros botones

```js
window.ariana.greet();
window.ariana.pause();
window.ariana.resume();
window.ariana.lookAt(coordenadaXDePantalla, coordenadaYDePantalla);
```

## Accesibilidad y rendimiento

- Respeta la preferencia del sistema de reducir movimiento; el usuario puede activarlo expresamente.
- Detiene el bucle cuando el personaje sale de pantalla o la pestaña queda oculta.
- Recorta la malla a las zonas pintadas de cada capa para reducir trabajo de la GPU.
- Conserva una imagen estática si WebGL no está disponible o falla la carga.
- Incluye controles de teclado y foco visible.

El personaje no requiere GSAP, Live2D, Rive, npm, claves API ni conexión a un servicio de animación. La página conserva las fuentes e íconos externos que ya utilizaba; si no hay Internet, esos recursos pueden cambiar de aspecto, pero el rig usa archivos locales.

## Reemplazar en tu web

Copiá `index.html`, `style.css`, `interaction.js` y la carpeta **assets/** completa, conservando las carpetas **img/** y **video/**. También podés reemplazar la carpeta del proyecto por esta versión completa. No necesita migraciones ni cambios de backend. Si el navegador muestra la versión anterior, recargá con Ctrl+F5.
