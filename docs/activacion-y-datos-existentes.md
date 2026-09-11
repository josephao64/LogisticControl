# Activación y datos existentes

Este cambio está preparado en una rama separada. La instalación de dependencias, pruebas y compilación no utiliza ni modifica datos de producción. No se ha desplegado ni aplicado configuración remota.

## Datos anteriores

Se conservan los catálogos existentes y las solicitudes anteriores. Los pedidos que no tienen schemaVersion 2 aparecen en Pedidos anteriores como consulta. No se fabrican conteos originales, aprobaciones, facturas o movimientos que esos pedidos no tienen.

Antes de cambiar el sistema utilizado por las sucursales, terminar los pedidos abiertos en la versión anterior o preparar una conciliación específica con datos verificados. Esta versión no transforma ni continúa automáticamente pedidos antiguos. El primer conteo completo establece la observación inicial de cada sucursal; las existencias antiguas de bodega requieren una estrategia de apertura antes de usarse como stock disponible.

Revisar los precios en precio_compra, proveedores, empresas y asignaciones del surtido. Definir stock ideal y calendarios para cada sucursal antes de pedir. El conteo no utiliza promedios semanales antiguos como sustitutos automáticos del ideal.

## Acceso

La API requiere una sesión real y un perfil activo en users. La primera cuenta se crea en Firebase Authentication; el comando bootstrap-admin asigna el primer administrador y rechaza ejecuciones posteriores cuando ya existe uno. Las demás cuentas se crean desde Administración / Usuarios con correo y contraseña inicial; allí se editan roles, sedes y estado activo. No se necesita copiar un UID para cada nueva cuenta. Un operador con alcance por sucursal requiere también su empresa en companyIds.

La aplicación no incluye contraseña predeterminada ni autenticación ficticia. El frontend conserva la configuración pública del proyecto original `db-logistica`; las variables de `frontend/.env.example` sirven para reemplazarla cuando se use otro proyecto. El backend sí requiere sus credenciales privadas mediante `backend/.env`. Revisar las reglas de Firestore para que nadie eluda el backend mediante acceso directo.

## Validación antes de producción

Ejecutar el flujo con una sucursal y productos de prueba en un proyecto Firebase de pruebas: conteo cero, conteo sin compra, aprobación con ajuste, orden mixta por nodos, división de factura, recepción parcial, solución por Logística, despacho y recepción final. Confirmar que un usuario de otra sucursal no puede consultar ni modificar esos registros. No se han ejecutado pruebas con Firebase real ni pruebas visuales en navegador durante este cambio.

Las transacciones agrupan lecturas antes de escrituras y limitan el número de escrituras. Los historiales se consultan actualmente por snapshot completo del alcance autorizado; antes de operar con historiales voluminosos se debe introducir paginación y medir las consultas. Las colecciones de auditoría y movimientos son de solo inserción desde la API; el proyecto de nube debe limitar también las credenciales administrativas.

Las evidencias se registran mediante URL o referencia. No se incorpora carga de archivos ni envío automático a proveedores. Tampoco se contabilizan ventas, consumo, mermas, notas de crédito o pagos.
