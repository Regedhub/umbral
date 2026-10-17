# Servidor de Umbral

Relay de salas para el juego nativo de Unity 0.5 en Windows y Android. Máximo cuatro jugadores por sala, códigos de ocho caracteres, voz PCM de 24 kHz y emojis. No se guardan grabaciones de voz. El anfitrión mantiene la autoridad sobre la partida; al salir termina su sala.

## Publicar en Render

Usar este repositorio y la rama `main` como Blueprint. `render.yaml` configura un Web Service con Docker, plan `free` explícito, región Virginia, una instancia y comprobación `/health`. No requiere una base de datos, claves API ni variables secretas.

Tras el despliegue, comprobar la dirección HTTPS que asigne Render. `/health` debe devolver `ready: true` y protocolo 5. En la pestaña Internet del juego, ambos dispositivos deben usar la misma dirección cambiando `https://` por `wss://`. No escribir la dirección privada de otro jugador. El anfitrión crea una sala y comparte el código de ocho caracteres.

El plan Free de Render puede suspender el proceso tras 15 minutos sin tráfico y tarda aproximadamente un minuto en despertar. Antes de entrar, abrir `/health` y esperar a que esté listo. El cliente 0.5 tiene un límite de ocho segundos para conectar.

## Ejecutar y comprobar

Node.js 22 o posterior. Instalar las dependencias con `npm install` o `pnpm install`. Ejecutar `node start.mjs`. `PORT` indica el puerto interno (8787 por defecto) y `HOST` la interfaz (0.0.0.0 por defecto). Render proporciona TLS/WSS.

- `node check.mjs`: prueba local del relay.
- `node probe-public.mjs wss://DIRECCION`: comprueba HTTPS y establecimiento WSS públicos.
- `node check-public.mjs wss://DIRECCION`: comprueba salas, capacidad, aislamiento, paquetes de voz sintéticos, emojis, autoridad, identidad, recuperación tras inactividad y desconexión del anfitrión.

Los paquetes sintéticos no sustituyen una conversación con micrófonos físicos. Publicar el código no demuestra que el alojamiento esté listo; debe superar las comprobaciones públicas.
