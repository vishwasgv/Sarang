# Electrónica

Elegir **Electrónica** como su tipo de negocio activa el **seguimiento de número de serie**, el **seguimiento de IMEI**, el **seguimiento de garantía** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una tienda de electrónica.

## Seguimiento de Serie / Dispositivo

Abra **Seguimiento de Números de Serie** (etiquetado como "Device & Serial Tracking" para Electrónica) desde la barra lateral para registrar unidades de stock individuales y con identificación única — no solo "cuántos", sino cuál unidad exacta. Agregue un dispositivo de a uno con su producto, número de serie, duración de garantía en meses, fecha de compra y costo, o use **Importación Masiva** para pegar un lote entero de números de serie a la vez (uno por línea, con columnas de IMEI si corresponde). Cada dispositivo lleva un estado — **Disponible**, **Vendido**, **Devuelto** o **Defectuoso** — que puede cambiar en cualquier momento desde la lista.

Debido a que un producto con seguimiento de serie representa una unidad física, agregarlo a un carrito en Facturación bloquea su cantidad en 1 — no puede "vender 3" de un número de serie específico, solo vender esa única unidad.

## Seguimiento de IMEI

Para teléfonos y otros dispositivos con IMEI, cada registro de dispositivo también puede llevar dos números de IMEI (doble SIM). Un cuadro dedicado de **Búsqueda de IMEI** en la pantalla de Serial Tracking le permite buscar instantáneamente un dispositivo por IMEI y ver su estado y garantía de un vistazo — útil para búsquedas de posventa o de mostrador de reparación.

Si el módulo de Reparación/RMA está activado, la pantalla de Serial Tracking también obtiene un cuadro de **Búsqueda de Servicio** justo debajo de Búsqueda de IMEI — busque o escanee un número de serie O un IMEI y vea todo sobre esa unidad en un solo lugar: qué producto es, cuándo y a quién se vendió (con la factura y el precio), y su historial completo de tickets de reparación. Está diseñado exactamente para el momento en que un cliente llega con un dispositivo roto y sin papeles — una sola búsqueda le dice si realmente lo compró aquí, cuándo, y qué se ha hecho ya para repararlo. Ask Sarang (si está habilitado) también puede responder una pregunta directa como "buscar el número de serie [número]" de la misma manera.

## Seguimiento de garantía

La garantía de cada dispositivo se almacena como una duración en meses desde su fecha de compra/inicio de garantía, y Sarang calcula y muestra la fecha de vencimiento real justo al lado — mostrada como aún válida o claramente marcada **Vencida** una vez que ha pasado. Ask Sarang (si está activado) también puede responder "¿Qué artículos todavía están en garantía?" directamente a partir de estos datos.

## Tickets de reparación / RMA

Un dispositivo vendido y con seguimiento de número de serie obtiene un botón **Reparación** en Serial Tracking — ábralo para ver el historial completo de servicio de esa unidad, o iniciar un nuevo ticket de reparación para ella. Un ticket lleva un número de reclamo y avanza por **Recibido → Diagnosticado → Enviado al Proveedor → Esperando Repuestos → Reparado/Reemplazado → Devuelto al Cliente** (o Cancelado, solo antes de que un reemplazo realmente haya salido). Registre a qué proveedor lo envió y su propio número de RMA si va a reparación bajo garantía.

Si la solución es un cambio directo, elija **Reemplazado** y seleccione una unidad en stock del mismo producto como reemplazo — Sarang marca la unidad original como Defectuosa, el reemplazo como Vendido (heredando la factura de la venta original) y lo descuenta del stock automáticamente, igual que cualquier otra venta. Un ticket de reparación solo puede abrirse contra una unidad que realmente fue vendida — un dispositivo en stock que nunca se vendió aún no tiene historial de servicio que rastrear.

En el momento en que un ticket pasa a **Enviado al Proveedor**, Sarang inicia automáticamente un plazo de 30 días — sin ningún paso adicional. Si una unidad sigue con el proveedor pasado ese plazo, se marca como **Atrasado** directamente en la lista de Tickets de Reparación (con cuántos días lleva realmente fuera), el encabezado de la propia pantalla muestra un recuento de atrasos en curso, y también aparece una alerta en el Panel — para que una unidad atascada con un proveedor por más de un mes nunca pase desapercibida.

Para tener la imagen completa de todos los RMA abiertos, no solo los atrasados, abra **Informes → Informe de Antigüedad de RMA**: cada unidad actualmente con un proveedor, clasificada de la más antigua a la más reciente, con un gráfico que muestra exactamente cuántos días lleva fuera cada una — las que superan la marca de 30 días destacan en rojo.

Cuando un ticket de reparación sale para reparación en garantía con un proveedor, también puede rastrear lo que el proveedor le debe a cambio. Dentro de la vista de detalle del ticket, haga clic en **Registrar Reclamación** e ingrese el monto que está reclamando al proveedor — Sarang mantiene un total continuo de Reclamado / Recuperado / Pendiente justo ahí. A medida que el proveedor le paga, ya sea de una vez o en partes, registre cada pago con **Registrar Recuperación**; la reclamación se cierra automáticamente una vez que el monto recuperado alcanza lo reclamado. Si un proveedor nunca va a pagar (por ejemplo, rechaza la reclamación), use **Dar de Baja** para cerrarla sin recuperación. Cada reclamación abierta y cerrada en todos los tickets se resume en **Informes → Libro de Recuperación de Proveedores**, con el total pendiente entre todos los proveedores y un gráfico de sus reclamaciones impagas más grandes.

También puede asignar un técnico a un ticket de reparación — al momento de la entrada cuando lo crea, o en cualquier momento posterior desde la vista de detalle del ticket. Una vez que un ticket tiene un técnico y una fecha de entrega completada, se incluye en **Informes → Tiempo de Reparación por Técnico**: tiempo de reparación promedio, más rápido y más lento por técnico, con un gráfico que los clasifica de más rápido a más lento. Es un número real de calidad de servicio — el tipo de dato que le dice a quién recurrir para un trabajo urgente, y quién podría necesitar una mano.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Electrónica incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **Nota de Recepción**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
