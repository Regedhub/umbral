# Registro y cuenta administradora · versión 0.6.0

El código está preparado. **Todavía no se ha publicado ni activado el registro en el servidor de Render.** El juego puede seguir usando las salas existentes sin una cuenta. La pantalla CUENTA / REGISTRO muestra que el servicio aún no está activado cuando el alojamiento conserva la versión anterior.

La cuenta propietaria preparada se llama **UmbralAdmin**. Su contraseña inicial está solo en `%LOCALAPPDATA%\UmbralOwner\Cuenta-admin.txt`, fuera del proyecto, del APK y de los archivos que se publican. No se debe subir ese archivo. `owner-bootstrap.json` contiene el identificador y un hash con sal, sin la contraseña. Al inicializar una base de datos se reserva ese nombre y se crea el propietario como administrador. Un registro normal siempre crea un jugador; enviar un rol diferente no cambia los permisos. Nadie obtiene administración por ser el primer jugador registrado.

Para activar el sistema:

1. Conectar GitHub y Render a esta sesión, o publicar los archivos de esta carpeta en el repositorio existente `Regedhub/umbral` desde las cuentas del propietario. Publicar `accounts.mjs`, `owner-bootstrap.json`, `server.mjs`, `start.mjs`, `package.json` y `Dockerfile`. No publicar la contraseña ni un archivo `.env`.
2. Conectar una base PostgreSQL y configurar su conexión como variable secreta `DATABASE_URL` en el servicio existente. Mantener la verificación TLS predeterminada de la conexión; no desactivar certificados. El sistema usa tres conexiones y crea las tablas `umbral_users` y `umbral_sessions` al arrancar.
3. Desplegar y comprobar `GET /accounts/status`: debe devolver `enabled: true`. `/health` conserva protocolo 5 y añade el estado de las cuentas. La falta de PostgreSQL no debe impedir jugar con el relay.
4. En el juego, abrir CUENTA / REGISTRO, entrar como UmbralAdmin y cambiar la contraseña inicial. El administrador no puede administrar cuentas antes de cambiarla. Luego puede consultar, suspender o reactivar hasta cien cuentas por consulta. Se impide suspender la cuenta administradora.
5. Verificar con dos cuentas reales registro, inicio de sesión, cambio de clave, cierre de sesión y suspensión. Comprobar que persisten tras reiniciar el servicio. Estas pruebas de despliegue siguen pendientes.

El servicio gratuito de Render no conserva datos escritos en su sistema de archivos entre despliegues; por eso las cuentas se guardan en PostgreSQL, nunca en un JSON dentro del contenedor. Las bases gratuitas de Render caducan a los 30 días: para cuentas permanentes se necesita una base persistente sin esa caducidad. No se ha creado una base temporal ni contratado un plan de pago. Referencia: https://render.com/docs/free.

Protecciones incluidas: scrypt N=131072, r=8, p=1 y sal aleatoria de 16 bytes; comparación de hash en tiempo constante; nombres únicos sin distinguir mayúsculas; sesiones aleatorias de 24 horas almacenadas como hash; máximo cinco sesiones por usuario; revocación al cambiar contraseña, suspender o cerrar sesión; límites de solicitud y un cálculo de hash a la vez. La aplicación mantiene el token solo en memoria y no guarda contraseñas en PlayerPrefs. Referencias: https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback y https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html.

`node check-accounts.mjs` comprueba la lógica con un almacén de memoria de prueba y sin abrir un servidor local: rechazo de escalada de rol, reserva del administrador, cambio de clave inicial, sesiones, caducidad, cierre, suspensión y límites. No acredita una base PostgreSQL ni el servicio público desplegado. `prepare-owner.mjs` sirve para la preparación inicial y se niega a sobrescribir una cuenta ya preparada.
