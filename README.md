# Relay de Umbral · clientes 0.6.0

El protocolo de salas sigue siendo 05. Se ha preparado el servicio de cuentas en accounts.mjs, pero no se ha desplegado ni conectado a PostgreSQL. Consulta CUENTAS.md para su activación y las pruebas pendientes. El registro de usuarios no concede permisos de administrador; la cuenta propietaria se reserva mediante owner-bootstrap.json, que contiene solo su hash. Las contraseñas y conexiones de base de datos no se incluyen en los paquetes del juego.

## Historial del alojamiento

# Relay de Umbral · servidor 0.5 / clientes 0.5.2

Estado al 17 de octubre de 2026: **el relay público de Render ha superado la prueba pública completa y los clientes nativos 0.5.2 de PC y Android lo incluyen por defecto**. Dirección `wss://umbral-relay-lk5v.onrender.com`; estado https://umbral-relay-lk5v.onrender.com/health. La pestaña Internet es la predeterminada: crear una sala y compartir el código de ocho caracteres. Consulta `../CONECTAR-INTERNET.md`. Dos procesos del ejecutable 0.5.1 completaron una misión usando la dirección incorporada. La versión 0.5.2 corrige la reproducción y el nivel de voz: dos clientes nativos pasaron el intercambio de audio sintético por WSS hasta el mezclador de salida. El APK 0.5.2 compiló y se verificaron versión, firma y nuevo DSP. Falta la conversación con micrófonos y un teléfono físico.

Se conserva el intento anterior de Higgsfield en https://umbral-relay.higgsfield.app: responde HTTP/WSS 401 y no se utiliza para jugadores.

Requiere Node.js 22 o posterior y un alojamiento que mantenga un proceso y conexiones WebSocket. La voz se retransmite en memoria; no se guarda audio. Cada sala admite cuatro jugadores. El anfitrión conserva la autoridad de la misión. Al desconectarse el anfitrión termina la sala.

Instalar dependencias con npm install o pnpm install y ejecutar node start.mjs. PORT configura el puerto interno (8787 por defecto), HOST la interfaz (0.0.0.0 por defecto). GET /health devuelve el estado. Se incluye un Dockerfile para un contenedor.

Para alojar otro relay, publicar el proceso detrás de HTTPS/WSS con certificado válido y configurar su URL wss:// en la pestaña INTERNET del juego. La versión 0.5.1 ya incluye Render y conserva los servidores personalizados guardados; las preferencias vacías o del antiguo alojamiento Higgsfield pasan a Render. No publicar el puerto TCP del transporte LAN como alternativa. El cliente permite ws:// solo en loopback para pruebas locales.

Una vez configurado el mismo servidor en ambos dispositivos: crear sala y compartir el código de ocho caracteres, o escribir el código para entrar. No hace falta introducir la IP del otro jugador ni abrir puertos en los móviles.

El propietario publicó los archivos en https://github.com/Regedhub/umbral y creó el Web Service en Render. La primera compilación falló porque faltaba Dockerfile; la revisión `f1af3bd` lo añadió. render.yaml configura Docker y plan Free explícito. Los servicios Free duermen después de 15 minutos sin tráfico y pueden tardar aproximadamente un minuto en despertar. El cliente 0.5.1 consulta automáticamente /health durante un máximo de 90 segundos antes de conectar; Volver cancela esa espera. Se probaron la respuesta de disponibilidad y la cancelación, pero no un ciclo completo de suspensión real de 15 minutos. En el cliente anterior 0.5 hay que abrir /health primero y esperar a que esté listo. Referencia: https://render.com/docs/free. No se ha activado un plan de pago ni guardado una clave API.

La publicación de Higgsfield figura como deployed, pero eso no demuestra acceso público. El rechazo 401 coincide con un problema reportado en https://github.com/higgsfield-ai/cli/issues/63. No se han compartido cookies o credenciales del propietario para sortearlo. cloud-deployment.json conserva el identificador del proyecto y la revisión publicada. El panel incluye la entrada cinematográfica solicitada, copiar dirección y consulta de estado; no pudo verificarse visualmente por el bloqueo de acceso. No se publicó en la comunidad: la portada obligatoria no pudo generarse porque Higgsfield exige un plan Basic o superior.

Comprobar un alojamiento con node probe-public.mjs wss://SERVIDOR; comprueba HTTP y el establecimiento de WSS sin iniciar un servidor local. Ejecutar node check-public.mjs wss://SERVIDOR para comprobar salas, límite de cuatro plazas, aislamiento, paquetes de voz sintéticos, emojis, autoridad, identidad, recuperación tras inactividad y salida del anfitrión. Render superó esta prueba: `public-check-render-final-2026-10-17.log` contiene `UMBRAL_PUBLIC_RELAY_PASS`. La prueba inicial usaba seis segundos para el aviso de desconexión; se ajustó a 35 segundos, coherente con dos ciclos del heartbeat de 15 segundos. El cierre real tardó 10.421 ms y se comprobó también que la sala anterior ya no acepta jugadores. Los paquetes sintéticos no prueban una conversación real ni el rendimiento entre países.

Prueba del relay: node check.mjs. Verifica límite de cuatro plazas, códigos, audio PCM, emojis, autoridad, identidad y desconexión. Para uso público con más usuarios, añadir protección contra abuso en el proveedor, métricas y una prueba de carga; este servicio no tiene cuentas ni migración de anfitrión.
