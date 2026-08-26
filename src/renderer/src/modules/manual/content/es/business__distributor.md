# Distribuidor / Mayorista

Elegir **Distribuidor** como su tipo de negocio activa la **aplicación de límite de crédito**, la **entrada de pedidos al por mayor**, el **análisis de saldos pendientes** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de un negocio distribuidor/mayorista.

## Entrada de Pedidos al por Mayor

Abra **Bulk Order Entry** desde la barra lateral para armar rápidamente un gran pedido mayorista — busque y agregue productos uno por uno (cada línea nueva usa por defecto cantidad 1 y su precio de venta normal), luego ajuste las cantidades directamente. El precio por volumen se activa automáticamente por línea según la cantidad pedida:

- 10+ unidades → 5% de descuento
- 50+ unidades → 10% de descuento
- 100+ unidades → 15% de descuento

Se aplica el nivel más alto que califique la línea; las cantidades pequeñas ordinarias no reciben descuento. Busque y adjunte un cliente mayorista al pedido (obligatorio si elige Crédito como método de pago — los pedidos en Efectivo, UPI y Tarjeta no necesitan un cliente), opcionalmente anote una referencia de pedido y notas de entrega, y envíe — esto crea una factura normal que encontrará después en Facturas, etiquetada con la referencia del pedido al por mayor en sus notas.

## Precios negociados por cliente

Agrupe a sus clientes en una **clase de cliente** (desde su registro en Clientes — p. ej. "Mayorista", "Minorista") y establezca precios específicos por clase para cada producto desde la nueva pantalla **Precios por Clase de Cliente**. Una vez establecidos, Bulk Order Entry (y un pedido capturado por un representante de campo, más abajo) cotiza automáticamente el carrito de ese cliente a su tarifa negociada en lugar del precio de venta normal — un cliente sin precio de clase registrado simplemente se factura al precio de lista como antes.

## Envíos de múltiples paradas

Un envío puede llevar varias **paradas** en lugar de una sola dirección de destino — abra el detalle de un envío y agregue cada parada de la ruta con su propia dirección y estado de entrega, de modo que un recorrido con múltiples entregas se rastree como la ruta real que es, y no como un solo destino con todo lo demás asumido como entregado a la vez.

## Captura de pedidos por representantes de campo

Active **Captura de Pedidos de Campo** para que sus representantes de ventas envíen pedidos desde su propio teléfono mientras visitan clientes, usando el WiFi de su tienda — sin necesidad de instalar ninguna app. Abra **Pedidos de Campo** para ver el enlace LAN/código QR que se comparte con los representantes, y para **Aceptar** o **Rechazar** las solicitudes entrantes. Un representante solo elige productos y cantidades — Sarang siempre vuelve a verificar el precio negociado real del cliente (y su límite de crédito) en el momento en que usted acepta, no lo que estimó el teléfono del representante, así que la factura que realmente se crea siempre queda correctamente facturada.

## Planes de Ruta

Abra **Planes de Ruta** para definir la ruta de visita propia de cada representante de campo — una ruta con nombre (p. ej., "Ruta Norte, martes") que incluye un representante, opcionalmente un día de la semana, y una lista ordenada de paradas de clientes. Añada clientes a una ruta y reordénelos con las flechas arriba/abajo para que coincida con el orden en que el representante realmente recorre la ruta; una ruta puede marcarse como inactiva sin eliminarla si se pausa. Esto es independiente de las paradas de un envío de reparto anterior — una ruta es la secuencia planificada de visitas a clientes de un representante de ventas, no la ruta de carga de un vehículo.

## Análisis de Saldos Pendientes

Abra **Análisis de saldos pendientes** para ver su exposición total de crédito en todos los clientes mayoristas con un saldo pendiente: total pendiente, cuántos clientes están actualmente por encima de su límite de crédito, y el saldo pendiente promedio por cliente. Un desglose de **antigüedad** muestra cuánto tiempo lleva pendiente cada monto — Actual, 1-30 días, 31-60 días, 61-90 días, más de 90 días — para que pueda ver no solo cuánto se debe sino qué tan atrasado está. La lista de clientes debajo muestra el límite de crédito de cada uno, su saldo pendiente actual (con una barra de progreso hacia su límite) y su cifra de más de 90 días, y está ordenada para que cualquiera por encima de su límite resalte en rojo. Toque cualquier cliente para ir directamente a su registro completo.

## Aplicación de límite de crédito

Asigne a un cliente un **límite de crédito** desde su registro en **Clientes**, y Sarang bloquea cualquier nueva venta *a crédito* (desde Facturación o Bulk Order Entry) que empujaría su saldo pendiente por encima de ese límite — rechazada de plano al momento de guardar con un mensaje que muestra su saldo pendiente, el monto de la nueva factura y su límite. Esto solo se aplica a ventas por método de Crédito; las ventas en Efectivo, UPI, Tarjeta y Pago Dividido no se ven afectadas. Un límite de crédito de 0 significa que no se aplica ningún límite.

El límite realmente aplicado está **ajustado por riesgo**, no siempre el número bruto registrado en la ficha del cliente: Sarang califica el historial de pagos de cada cliente con crédito (facturas actualmente vencidas y cuánto se retrasaron los pagos de facturas anteriores) en un nivel de riesgo — Bajo, Medio, Alto, o Sin Calificar para un cliente sin historial de pagos aún — y ajusta el límite de crédito en consecuencia (el riesgo Bajo obtiene 1.25× el límite indicado, el Medio y el Sin Calificar lo usan tal cual, el riesgo Alto se limita a 0.5×). Abra la propia ficha de un cliente para ver su nivel de riesgo actual y su límite ajustado por riesgo junto a su límite de crédito.

## Informe de Costo de Esquema vs. Volumen

Si ejecuta esquemas de precios (Compre-X-Lleve-Y-Gratis o descuentos por escalones — configúrelos en Configuración → Esquemas de Precios), abra **Costo de Esquema vs. Volumen** en Informes para ver si realmente están funcionando: un gráfico muestra cuánto le costó el esquema (el valor de las unidades gratuitas entregadas, o el monto del descuento para un esquema por escalones) junto con cuántas unidades del producto cubierto realmente se vendieron, semana a semana, además de un desglose de costo por esquema debajo. Esto es una comparación lado a lado, no una afirmación de que el esquema *causó* el volumen — Sarang no tiene forma de saber cuánto habría vendido sin el esquema, así que lea el gráfico como evidencia para juzgar usted mismo, no como un veredicto.

## Informe de Tabla de Clasificación de Representantes

Abra **Field-Rep Leaderboard** desde Informes para ver el desempeño de cada representante de campo: pedidos reservados, valor total, clientes distintos visitados, y — para un representante con una ruta activa — una tasa de cumplimiento que muestra qué porcentaje de sus paradas planificadas realmente visitó. Los representantes se clasifican de mejor a peor por valor, por lo que esto se lee como una tabla de clasificación, no como una lista de problemas. Un representante sin ruta activa simplemente no muestra ninguna cifra de tasa de cumplimiento, en lugar de un 0% engañoso.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Distribuidor incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **Nota de Recepción**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
