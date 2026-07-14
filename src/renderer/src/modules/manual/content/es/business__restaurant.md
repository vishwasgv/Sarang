# Restaurante

Elegir **Restaurante** como su tipo de negocio durante la configuración activa cuatro cosas además de las funciones universales que recibe todo negocio: **Mesas**, **Comandas de Cocina (KOT)**, **Recetas** y el seguimiento de stock de ingredientes. Facturación, Clientes, Inventario e Informes funcionan todos de la misma manera descrita en sus propios capítulos — este capítulo solo cubre lo específico de administrar un restaurante.

## Mesas

Abra **Restaurant Tables** desde la barra lateral para ver cada mesa que ha configurado, cada una mostrada como una tarjeta con su estado actual: **Free** (Libre), **Busy** (Ocupada) o **Rsv** (Reservada). Agregue una mesa con un número de mesa (p. ej. "T1") y un nombre para mostrar opcional. Toque un botón de estado en la tarjeta de una mesa para cambiarlo — una mesa no se puede eliminar mientras tenga una comanda de cocina activa.

**End of Day** (Fin del Día) es un botón en esta pantalla: marca cada mesa ocupada como disponible de nuevo y muestra un resumen de cierre de una línea (KOT servidos e ingresos de hoy), para que pueda cerrar el comedor al final de un turno.

## Comandas de Cocina (KOT)

Un KOT es la copia de cocina de un pedido. Después de registrar un pedido en **Facturación**, abra la factura y toque **Send to Kitchen** para crear un KOT para ella. Desde **Kitchen Order Tickets** en la barra lateral, el personal de cocina ve cada comanda agrupada por estado — Pending, In Progress, Done, Cancelled — con sus artículos y cantidades, y avanza cada una con un solo toque (**Start Cooking** → **Mark Done**), o la **Cancel** (cancela). Cada comanda también se puede imprimir directamente en su impresora de cocina.

Marcar un KOT como **Done** es lo que activa la deducción del stock de ingredientes (vea más abajo) y libera la mesa a la que pertenecía, una vez que ninguna otra comanda activa esté usando esa mesa.

## Recetas y seguimiento de ingredientes

Abra **Recipes** para vincular un artículo del menú (p. ej. "Masala Chai") con las materias primas que consume y cuánto de cada una — busque el producto del menú, nombre la receta, luego agregue filas de ingredientes (cada ingrediente solo puede aparecer una vez por receta; combine cantidades en lugar de agregar una fila duplicada). La lista de ingredientes de cada receta se muestra expandida en la vista de lista.

Una vez que existe una receta para un artículo del menú, completar su KOT (marcarlo como Done) deduce automáticamente las cantidades de ingredientes de la receta × la cantidad pedida de su stock de productos regular — no hay un inventario de ingredientes separado que mantener. Si el stock de un ingrediente no se puede ajustar por alguna razón, Sarang no pierde la discrepancia en silencio: genera una notificación indicándole qué ingrediente necesita un reconteo manual, de modo que sus números de stock nunca se desvíen silenciosamente.

Los artículos del menú sin receta configurada simplemente no deducen ningún stock de ingredientes al venderse — las recetas son totalmente opcionales por artículo.

## Pedidos por mesa con código QR (opcional)

Restaurant Tables también tiene un interruptor de **QR Table Ordering**, desactivado por defecto. Actívelo y Sarang inicia un pequeño servidor local en su propia red WiFi (sin necesidad de internet) para que los clientes puedan escanear el código QR impreso de una mesa, explorar el menú y enviar una solicitud de pedido desde su teléfono. Nada se convierte en una factura real automáticamente — cada pedido entrante aparece bajo **Incoming Orders** en la pantalla de Kitchen Order Tickets, donde el personal explícitamente lo **Accept** (elige un método de pago, lo que crea la factura y el KOT juntos) o lo **Reject**. El código QR de cada mesa se puede generar e imprimir desde su tarjeta en la pantalla de Restaurant Tables.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos. Si también activa Logística y Cadena de Suministro en **Configuración → Funciones Adicionales de Negocio**, obtiene también Flota, Transportistas, Envíos, GRN, Albarán de Entrega, Libro de Fletes y Análisis de Logística — pero esto no está activado por defecto para un restaurante, ya que la mayoría de los restaurantes no operan su propia flota de entrega ni reciben envíos formales de proveedores.
