# Logistic Control

Aplicación Vue 3 y API Express para conteo semanal, solicitudes, compras consolidadas, facturas por sucursal y recepción con diferencias autorizadas.

La versión de este cambio implementa las aclaraciones operativas del propietario. El inventario es manual: cada conteo semanal fija la existencia observada. Las entradas posteriores se registran, pero no se inventa un descuento por consumo ni un indicador ERI contra un saldo desconocido.

## Inicio

Requiere Node.js 22, un proyecto Firebase con Firestore y Authentication habilitado para correo/contraseña, y credenciales de servidor para la API.

1. En `backend`, copiar `.env.example` a `.env`. Configurar `FIREBASE_SERVICE_ACCOUNT` (JSON) o credenciales de aplicación predeterminadas. El SDK administrativo nunca se incluye en el frontend.
2. El frontend ya incluye la configuración pública del proyecto original `db-logistica`. Copiar `frontend/.env.example` a `frontend/.env` solamente si se utilizará otro proyecto o una URL de API distinta.
3. Instalar con `npm ci` en cada carpeta.
4. Crear la primera cuenta en Firebase Authentication. Ejecutar, desde `backend`, `node scripts/bootstrap-admin.js UID`. Este comando solo funciona antes de que exista un administrador.
5. Ejecutar `npm run dev` en ambas carpetas. Para producción usar `npm start` en backend y `npm run build` en frontend. Configurar `CORS_ORIGINS` con los orígenes autorizados del frontend.
6. Ingresar y revisar grupo, empresas, sucursales, proveedores y surtido. Definir stock ideal y días/hora límite por proveedor y sucursal. Crear las demás cuentas directamente desde Administración / Usuarios, indicando correo, contraseña inicial, rol, empresas y sucursales. El administrador puede editar permisos y desactivar cuentas sin borrar su historial.

`firestore.rules` contiene la política para impedir acceso directo desde el cliente: los datos se consultan y modifican mediante la API. Debe revisarse y aplicarse en el proyecto Firebase antes de producción. No se han cambiado reglas ni datos remotos durante este trabajo.

## Interfaz para PC y móvil

Navegación lateral en PC, accesos inferiores y menú completo en móvil. Pedidos y catálogos usan tarjetas, filtros y detalles desplegables; los formularios se abren en paneles adaptables. El conteo muestra progreso, búsqueda, filtro de pendientes y cantidades con controles táctiles. El resumen reúne cumplimiento semanal, diferencias y cambios auditados.

En desarrollo, Vite reenvía `/api` al backend local del puerto 3000. Para producción, configure el proxy HTTPS del dominio o `VITE_API_URL` antes de compilar. Consulte `docs/interfaz-y-administracion.md`.

## Comprobaciones

Desde `backend`: `npm test`. Desde `frontend`: `npm test` y `npm run build`.

Las pruebas cubren reglas de negocio con un repositorio transaccional aislado, autenticación y alcance con servicios simulados y solicitudes HTTP locales, y métricas. No sustituyen las pruebas de integración con Firebase ni la validación de usuarios en un entorno de pruebas.

## Documentación

- `docs/reglas-operativas.md`: comportamiento acordado, permisos y criterios de aceptación.
- `docs/activacion-y-datos-existentes.md`: configuración y transición segura desde el flujo anterior.

No se envían órdenes automáticamente al proveedor: se registran y descargan para que Logística las envíe por el canal habitual.
