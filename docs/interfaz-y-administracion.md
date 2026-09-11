# Interfaz y administración

## Uso en PC y móvil

- En PC: barra lateral, filtros y tarjetas distribuidas según el ancho disponible.
- En móvil: navegación inferior y botón Más para Stock y Administración. Formularios en panel inferior con desplazamiento y botones de confirmación.
- Conteo: ninguna cantidad física se precarga con cero. Ingresar cero confirma que se revisó el producto. Búsqueda y filtro de pendientes conservan las cantidades de los demás productos. Los borradores se guardan por usuario y sucursal en el dispositivo.
- Pedidos: vista de tarjetas o lista, filtros por sucursal, proveedor y estado; productos y facturas se despliegan dentro del pedido. Las acciones dependen del rol y estado.
- Historial: indicadores con datos reales, cumplimiento semanal, conteos desplegables y comparación de cambios. Sin datos se indica explícitamente.

## Administrador

Crear primero grupos, empresas, sucursales, proveedores y productos; después asignar el stock ideal y calendario de cada sucursal. Los productos requieren proveedor activo, unidad, precio no negativo y al menos una sucursal asignada. Un código de producto no puede repetirse. Los destinos por proveedor solo admiten sucursales existentes y bodega o tienda.

En Usuarios, Agregar usuario crea la cuenta de Authentication y su perfil. Indicar correo, contraseña de 8 a 128 caracteres, nombre y rol. Los roles distintos de Administrador requieren al menos una empresa y una sucursal para tener acceso activo. Cada sucursal debe pertenecer a una empresa autorizada. El rol Administrador tiene acceso global.

Editar usuario permite cambiar nombre, rol, alcance y estado. El correo existente es de consulta; no se cambia la contraseña desde esta pantalla. La recuperación de contraseñas se realiza con el procedimiento de Authentication del proyecto. No se envían correos desde esta función.

Desactivar bloquea la cuenta, revoca la renovación de sesiones y conserva auditoría. No se permite modificar el acceso propio, para evitar que el administrador se bloquee accidentalmente. La primera cuenta administrativa requiere el bootstrap documentado; las demás se crean desde la aplicación.

La creación inicia sin acceso y solo activa el perfil al terminar. Si ocurre un fallo, reintentar desde el mismo formulario con los mismos datos. Los perfiles con creación pendiente permanecen inactivos. Las contraseñas no se guardan en Firestore, auditoría ni almacenamiento del navegador; los identificadores de reintento usan una huella del contenido.

Desactivar un grupo, empresa o proveedor con dependientes activos requiere desactivar primero esos dependientes. Cambiar la empresa de una sucursal existente se bloquea para conservar el alcance de permisos y los datos históricos; crear otra sucursal si corresponde.

## Instalación y comprobación

El frontend usa la configuración pública original de Firebase; la API requiere credenciales privadas, nunca incluidas en el ZIP. Vite dirige `/api` al backend local en desarrollo. Para publicar, configurar HTTPS, proxy/API y CORS del dominio real.

Se verificaron compilación y pruebas locales con servicios simulados. Queda pendiente la validación con cuentas reales de Firebase y la revisión visual en dispositivos reales. No se modificaron datos ni configuración de producción.
