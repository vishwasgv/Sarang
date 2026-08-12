# Órdenes de Venta y Precios

## Órdenes de Venta

Una **Orden de Venta** (`/sales-orders`) es un compromiso de vender — el reflejo del lado de venta de una orden de compra. Úsela cuando un cliente ha confirmado que quiere algo pero usted aún no le factura: las mercancías no están listas para enviar, el servicio no ha comenzado, o está esperando un depósito. Una orden de venta nunca toca sus cuentas como lo hace una factura — nada se factura ni se registra ningún asiento contable hasta que realmente crea una factura a partir de ella.

Cree una con **Nueva Orden de Venta**: elija un cliente (o agregue uno sin salir del formulario), una fecha esperada opcional y líneas de artículos — cada una un producto real o un servicio de texto libre, el mismo selector de producto o servicio que ya usan Facturación y las órdenes de compra.

La orden de venta se mueve por **Borrador → Confirmada → Parcialmente Facturada → Facturada**, o puede **Cancelarse** (con un motivo) en cualquier etapa antes de facturarse por completo. Haga clic en **Confirmar Orden** para bloquearla. Desde una orden confirmada, haga clic en **Crear Factura** — no tiene que facturar toda la orden de una vez: una pantalla de facturación parcial le permite elegir exactamente cuánto facturar de cada línea ahora, dejando el resto para después. La pantalla de detalle de la orden mantiene una lista actualizada de cada factura creada a partir de ella, para que siempre pueda ver cuánto de la orden original se ha facturado realmente.

## Listas de Precios

Las **Listas de Precios** (`/pricing/price-lists`) le permiten configurar precios por nivel de cantidad para un cliente o proveedor — por ejemplo, un cliente mayorista paga menos por unidad cuando compra 50 o más unidades de un artículo. Cree una lista de precios, elija si se aplica a clientes o proveedores, y luego use **Administrar Niveles** para configurar la cuadrícula de filas {producto, cantidad mínima, precio}. Asigne una lista de precios a un cliente o proveedor específico desde su propio registro.

Al determinar el precio de una línea para un cliente o proveedor con una lista de precios asignada, Sarang determina el precio automáticamente: el nivel de mejor coincidencia de la propia lista de precios gana primero, luego recurre al precio por clase de cliente (el enfoque más limitado y antiguo que ya usan algunos negocios) si no hay ninguno, y finalmente al precio de venta o costo normal del producto si ninguno de los dos aplica. Nunca tiene que pensar en cuál está "activo" — el más específico para ese cliente o proveedor gana.

## Esquemas de Precios

Los **Esquemas de Precios** (`/pricing/schemes`) son ofertas promocionales que se evalúan automáticamente en el checkout: **Compre X Lleve Y Gratis** (por ejemplo, compre 2, lleve 1 gratis) y **Descuento por Volumen** (por ejemplo, 10% de descuento en 5+ unidades, 15% en 10+, con tantos puntos de quiebre como desee). Cree un esquema, restríjalo a un producto o a toda una categoría, configure su regla, y opcionalmente proporcione una fecha de inicio y fin para una oferta por tiempo limitado.

En el checkout, agregar un producto o cantidad elegible al carrito muestra una barra de oferta descartable con un botón **Aplicar** — aplicar una oferta Compre-X-Lleve-Y-Gratis agrega la línea gratuita por usted; aplicar una oferta de descuento establece automáticamente el descuento de esa línea. Estas son siempre solo sugerencias: nada se aplica hasta que hace clic en Aplicar, y se verifica de forma independiente contra las reglas del esquema reales y actuales al crear la factura final — nunca se puede engañar a un esquema para reducir el precio de una factura.

## Perfiles Recurrentes

Los **Perfiles Recurrentes** (`/recurring-profiles`) generan una factura, cuenta por pagar o gasto en un horario recurrente — semanal, mensual, trimestral o anual — para que no tenga que volver a crear el mismo documento manualmente cada período. Cree uno eligiendo el tipo de documento, completando los mismos detalles que llenaría una vez en una factura/cuenta por pagar/gasto, y configurando la recurrencia, la fecha de inicio y una fecha de fin opcional.

Sarang verifica automáticamente los perfiles vencidos mientras la aplicación está abierta (aproximadamente una vez por hora) y crea el documento silenciosamente — nunca obtendrá un duplicado para ningún período, incluso si la aplicación estaba cerrada cuando llegó el período, porque la siguiente verificación lo detectará. Haga clic en **Pausar** para dejar de generar un perfil sin eliminarlo, o **Reanudar** para volver a activarlo. Eliminar un perfil solo detiene la generación *futura* — los documentos que ya ha creado permanecen exactamente como están.

## Flujos de Aprobación

Los **Flujos de Aprobación** (`/approval-workflows`, normalmente configurados por un Administrador) requieren aprobación cuando el importe total de una orden de venta o de compra supera un umbral que usted establece — útil cuando más de una persona en un negocio puede comprometerse a una venta o compra. Un flujo de trabajo contiene uno o más **pasos**, cada uno especificando un aprobador (por rol, por ejemplo "Gerente", o por persona específica) y el importe mínimo de la orden que activa ese paso; un paso se omite silenciosamente si el importe de la orden no alcanza su umbral.

Cuando no hay ningún flujo de trabajo configurado — el valor predeterminado para cada instalación — las órdenes de venta y de compra se confirman de inmediato como antes; esta función es completamente opcional. Una vez que un flujo de trabajo está activo, confirmar una orden elegible la mueve a **Aprobación Pendiente** en lugar de confirmarla de inmediato, y aparece un panel de aprobación en la propia pantalla de detalle de la orden, listando cada paso y quién debe actuar. La aprobación o el rechazo se realizan desde ese mismo panel — rechazar cualquier paso rechaza toda la orden, pero una orden completamente aprobada completa la confirmación automáticamente. Un flujo de trabajo sin historial de aprobación aún se puede eliminar directamente; uno que ya se ha usado debe desactivarse en su lugar, lo que preserva su historial pero deja de aplicarse a nuevas órdenes.
