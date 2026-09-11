# Reglas operativas implementadas

Las aclaraciones del propietario prevalecen sobre el documento de diseño cuando difieren.

## Conteo e inventario manual

Cada sucursal debe contar todos los productos activos de su surtido. Los productos existentes sin asignación explícita se consideran disponibles para todas las sucursales hasta que el administrador configure su surtido. Un producto nuevo permite seleccionar sus sucursales. Cero es una respuesta válida y obligatoria cuando no existe producto; vacío, negativo o no numérico impide enviar. El backend repite la validación y no confía en la pantalla.

Se guarda el conteo completo, incluyendo productos con cantidad solicitada cero y conteos sin compra. La vista de historial muestra qué sucursales completaron el conteo de la semana de Guatemala. Un conteo adicional en la misma semana exige motivo. Cada borrador local pertenece al usuario y sucursal.

La sugerencia es máximo entre stock ideal menos físico y cero. Se conservan existencia, ideal, sugerencia, solicitud y aprobación. Encargado y Logística deben explicar sus cambios. Los ajustes conservan los originales y generan historial con usuario y fecha.

El nuevo conteo reemplaza la observación de saldo anterior; el movimiento se identifica como CONTEO_MANUAL, no como consumo o merma. La entrada recibida incrementa el saldo registrado. En tienda este saldo se identifica como conteo más entradas sin descontar consumo y no se presenta como existencia real actualizada. La bodega registra entradas y despachos. Cada recepción, movimiento, saldo e historial se confirma en la misma transacción.

## Stock ideal y calendario

El ideal inicial se introduce manualmente. Logística puede calcular una propuesta utilizando la cantidad solicitada del último conteo de cada una de hasta cuatro semanas, con al menos dos semanas disponibles. Se muestra explícitamente que esto no representa consumo. Solo una autorización expresa aplica la propuesta; si cambió el ideal mientras estaba pendiente, se exige una nueva propuesta.

Cada combinación proveedor/sucursal tiene días permitidos y hora límite en America/Guatemala. No se inventan valores iniciales. Fuera del calendario la solicitud se permite pero se marca como emergencia. El conteo sigue siendo completo.

## Solicitudes y órdenes

La solicitud se revisa y aprueba antes de consolidarse. La consolidación admite varias empresas y sucursales del mismo proveedor en una sola orden. Secciones BODEGA y DIRECTO_TIENDA conservan asignación a solicitud, empresa, sucursal y producto. La orden se registra con una fecha de entrega comprometida explícita y puede descargarse de nuevo. El total se calcula en servidor con el precio de compra conservado al solicitar.

Una solicitud no puede pertenecer a dos órdenes. Una orden no envía mensajes ni correos al proveedor automáticamente.

## Facturas

Cada factura pertenece a un pedido de una sucursal. Se heredan empresa y proveedor del pedido. La clave combina empresa, proveedor y número normalizado. El mismo número puede existir para otro proveedor o empresa, pero no repetirse dentro de la misma combinación.

La división opcional se realiza registrando varias facturas del mismo pedido, con productos, cantidades y precios propios. La pantalla muestra la cantidad restante por facturar. La suma de las cantidades asignadas a facturas no puede exceder la aprobación; no se permite asignar productos de otro pedido. Una factura no combina sucursales.

## Recepción, diferencias y cierre

Se registran facturas antes de recibir. La comparación incluye cantidad aprobada, facturada y recibida acumulada, y diferencias de precio. La recepción conserva responsable, causa y evidencia cuando existen diferencias. Evidencia es una referencia verificable o un enlace, no un archivo subido desde esta versión.

Las entregas parciales acumulan cantidades sin repetir el ingreso de las entregas anteriores. La siguiente recepción sustituye el pendiente de comparación y conserva los eventos anteriores. Si completa lo esperado, puede continuar el flujo. Si queda diferencia, solo Logística o Administrador autoriza la solución escrita para aceptar lo recibido; no se registra contabilidad de notas de crédito.

En BODEGA se recibe, se resuelve cualquier diferencia, se registra una referencia de despacho y luego la tienda confirma. En DIRECTO_TIENDA la sucursal recibe y confirma. El cumplimiento del proveedor termina con la recepción final en tienda. Una autorización posterior no cambia la fecha real de recepción. Los reintentos de la misma operación conservan la misma clave y no duplican movimientos.

## Roles

| Rol | Operaciones |
| --- | --- |
| Administrador | Configuración, accesos, catálogos y todas las operaciones |
| Tienda | Conteo, solicitudes, facturas de entrega directa y recepción de sus sucursales |
| Logística | Revisión, rechazo, órdenes, facturas, stock, calendarios y autorización de diferencias |
| Bodega | Factura y recepción de pedidos destinados a bodega, despacho |
| Gerencia / Auditoría | Consulta de historial e indicadores |

La identidad se verifica con Firebase Auth. El rol y las empresas/sucursales permitidas se leen del perfil en servidor. Un encabezado enviado por el navegador no concede permisos. Los catálogos se desactivan conservando referencias; no se borran físicamente desde la interfaz.

## Indicadores

Entrega a tiempo compara recepción final en tienda contra fecha prometida. Entrega completa cuenta pedidos donde todas las líneas cumplen la cantidad aprobada; sobrantes de una línea no compensan faltantes de otra. Rectificación y emergencia se calculan sobre solicitudes. El tiempo promedio mide creación a recepción final. Sin recepciones se muestra Sin datos. No se calcula ERI porque no existe fuente de consumo para establecer un saldo teórico fiable.
