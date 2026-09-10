# Cuenta Juntos

Contador colaborativo en tiempo real para equipos. Permite crear varios contadores, aumentar o retroceder el valor, iniciar sesión e invitar a otras cuentas por correo. Cada movimiento se conserva con persona, fecha, hora y segundos, y puede consultarse con búsqueda y filtros.

## Probarlo ahora

Abre `index.html` en un navegador moderno y pulsa **Probar modo demo**. Los datos demo se guardan en el navegador, por lo que no necesitan Firebase.

## Activar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Registra una aplicación web y copia su configuración.
3. En `app.js`, reemplaza los valores del objeto `firebaseConfig` con los de tu proyecto. No publiques claves privadas: la configuración web de Firebase está diseñada para estar en el frontend.
4. En Authentication > Sign-in method habilita **Email/Password**.
5. Crea una base de datos Firestore en producción o modo prueba y publica el contenido de `firestore.rules`.
6. Sirve la carpeta con cualquier servidor estático. Por ejemplo, con VS Code puedes usar Live Server, o instalar Node.js y ejecutar `npx serve .`.

La app incluye `manifest.webmanifest`, `sw.js` e `icon.svg` para instalarse como PWA. La instalación requiere servirla por HTTPS o desde `localhost`; abrir directamente el archivo HTML no permite registrar el service worker.

Los movimientos nuevos se guardan en la subcolección `counters/{counterId}/events`. Después de publicar las reglas, Firestore los sincroniza en tiempo real y la vista de actividad permite buscar por persona/acción y filtrar por fechas.

La colaboración funciona así: cada persona crea su propia cuenta. El propietario abre **Compartir**, escribe el correo de la persona y, si ya está registrada, la añade al contador. Todos los miembros pueden sumar y restar; solo el propietario puede eliminar el contador.

## Publicar

Puedes subir este proyecto a GitHub y publicarlo con GitHub Pages usando una acción de Pages o alojarlo en Firebase Hosting. Para una app con Firebase, Firebase Hosting suele ser la opción más directa.

## Estructura

- `index.html`: vistas de acceso, panel y diálogos.
- `styles.css`: diseño responsive desde 320px.
- `app.js`: autenticación, Firestore, modo demo y eventos.
- `firestore.rules`: permisos de propietario y miembros.
