# Electrónica

Elegir **Electrónica** como su tipo de negocio activa el **seguimiento de número de serie**, el **seguimiento de IMEI**, el **seguimiento de garantía** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una tienda de electrónica.

## Seguimiento de Serie / Dispositivo

Abra **Serial Tracking** (etiquetado como "Device & Serial Tracking" para Electrónica) desde la barra lateral para registrar unidades de stock individuales y con identificación única — no solo "cuántos", sino cuál unidad exacta. Agregue un dispositivo de a uno con su producto, número de serie, duración de garantía en meses, fecha de compra y costo, o use **Bulk Import** para pegar un lote entero de números de serie a la vez (uno por línea, con columnas de IMEI si corresponde). Cada dispositivo lleva un estado — **Disponible**, **Vendido**, **Devuelto** o **Defectuoso** — que puede cambiar en cualquier momento desde la lista.

Debido a que un producto con seguimiento de serie representa una unidad física, agregarlo a un carrito en Facturación bloquea su cantidad en 1 — no puede "vender 3" de un número de serie específico, solo vender esa única unidad.

## Seguimiento de IMEI

Para teléfonos y otros dispositivos con IMEI, cada registro de dispositivo también puede llevar dos números de IMEI (doble SIM). Un cuadro dedicado de **IMEI Lookup** en la pantalla de Serial Tracking le permite buscar instantáneamente un dispositivo por IMEI y ver su estado y garantía de un vistazo — útil para búsquedas de posventa o de mostrador de reparación.

## Seguimiento de garantía

La garantía de cada dispositivo se almacena como una duración en meses desde su fecha de compra/inicio de garantía, y Sarang calcula y muestra la fecha de vencimiento real justo al lado — mostrada como aún válida o claramente marcada **Vencida** una vez que ha pasado. Ask Sarang (si está activado) también puede responder "¿Qué artículos todavía están en garantía?" directamente a partir de estos datos.

## Tickets de reparación / RMA

Un dispositivo vendido y con seguimiento de número de serie obtiene un botón **Repair** en Serial Tracking — ábralo para ver el historial completo de servicio de esa unidad, o iniciar un nuevo ticket de reparación para ella. Un ticket lleva un número de reclamo y avanza por **Recibido → Diagnosticado → Enviado al Proveedor → Esperando Repuestos → Reparado/Reemplazado → Devuelto al Cliente** (o Cancelado, solo antes de que un reemplazo realmente haya salido). Registre a qué proveedor lo envió y su propio número de RMA si va a reparación bajo garantía.

Si la solución es un cambio directo, elija **Reemplazado** y seleccione una unidad en stock del mismo producto como reemplazo — Sarang marca la unidad original como Defectuosa, el reemplazo como Vendido (heredando la factura de la venta original) y lo descuenta del stock automáticamente, igual que cualquier otra venta. Un ticket de reparación solo puede abrirse contra una unidad que realmente fue vendida — un dispositivo en stock que nunca se vendió aún no tiene historial de servicio que rastrear.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Electrónica incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **GRN**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
