# Distribuidor / Mayorista

Elegir **Distribuidor** como su tipo de negocio activa la **aplicación de límite de crédito**, la **entrada de pedidos al por mayor**, el **análisis de saldos pendientes** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de un negocio distribuidor/mayorista.

## Entrada de Pedidos al por Mayor

Abra **Bulk Order Entry** desde la barra lateral para armar rápidamente un gran pedido mayorista — busque y agregue productos uno por uno (cada línea nueva usa por defecto cantidad 1 y su precio de venta normal), luego ajuste las cantidades directamente. El precio por volumen se activa automáticamente por línea según la cantidad pedida:

- 10+ unidades → 5% de descuento
- 50+ unidades → 10% de descuento
- 100+ unidades → 15% de descuento

Se aplica el nivel más alto que califique la línea; las cantidades pequeñas ordinarias no reciben descuento. Busque y adjunte un cliente mayorista al pedido (obligatorio si elige Crédito como método de pago — los pedidos en Efectivo, UPI y Tarjeta no necesitan un cliente), opcionalmente anote una referencia de pedido y notas de entrega, y envíe — esto crea una factura normal que encontrará después en Facturas, etiquetada con la referencia del pedido al por mayor en sus notas.

## Análisis de Saldos Pendientes

Abra **Outstanding Analytics** para ver su exposición total de crédito en todos los clientes mayoristas con un saldo pendiente: total pendiente, cuántos clientes están actualmente por encima de su límite de crédito, y el saldo pendiente promedio por cliente. Un desglose de **antigüedad** muestra cuánto tiempo lleva pendiente cada monto — Actual, 1-30 días, 31-60 días, 61-90 días, más de 90 días — para que pueda ver no solo cuánto se debe sino qué tan atrasado está. La lista de clientes debajo muestra el límite de crédito de cada uno, su saldo pendiente actual (con una barra de progreso hacia su límite) y su cifra de más de 90 días, y está ordenada para que cualquiera por encima de su límite resalte en rojo. Toque cualquier cliente para ir directamente a su registro completo.

## Aplicación de límite de crédito

Asigne a un cliente un **límite de crédito** desde su registro en **Clientes**, y Sarang bloquea cualquier nueva venta *a crédito* (desde Facturación o Bulk Order Entry) que empujaría su saldo pendiente por encima de ese límite — rechazada de plano al momento de guardar con un mensaje que muestra su saldo pendiente, el monto de la nueva factura y su límite. Esto solo se aplica a ventas por método de Crédito; las ventas en Efectivo, UPI, Tarjeta y Pago Dividido no se ven afectadas. Un límite de crédito de 0 significa que no se aplica ningún límite.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Distribuidor incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **GRN**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
