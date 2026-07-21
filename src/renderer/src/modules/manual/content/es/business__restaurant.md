# Restaurante

Elegir **Restaurante** como su tipo de negocio durante la configuración activa cuatro cosas además de las funciones universales que recibe todo negocio: **Mesas**, **Comandas de Cocina (KOT)**, **Recetas** y el seguimiento de stock de ingredientes. Facturación, Clientes, Inventario e Informes funcionan todos de la misma manera descrita en sus propios capítulos — este capítulo solo cubre lo específico de administrar un restaurante.

## Mesas

Abra **Restaurant Tables** desde la barra lateral para ver cada mesa que ha configurado, cada una mostrada como una tarjeta con su estado actual: **Free** (Libre), **Busy** (Ocupada) o **Rsv** (Reservada). Agregue una mesa con un número de mesa (p. ej. "T1") y un nombre para mostrar opcional. Toque un botón de estado en la tarjeta de una mesa para cambiarlo manualmente — o deje que el estado de una mesa siga una orden real automáticamente, vea abajo. Una mesa no se puede eliminar mientras tenga una comanda de cocina activa. Asigne un **mesero** a una mesa desde su tarjeta para siempre saber quién la está atendiendo; borre la asignación en cualquier momento.

**Start Order** en la tarjeta de una mesa libre abre Billing con esa mesa ya vinculada — arme el carrito como siempre y confirme la venta. La mesa ahora está realmente vinculada a esa cuenta: su tarjeta muestra **View Bill** (va directo a la factura) y **Merge In** en lugar de Start Order, y la mesa se libera automáticamente en cuanto la cuenta se paga por completo o se cancela — sin tener que recordar cambiar su estado a mano.

**Merge In** une una segunda mesa a la misma cuenta en curso — para un grupo grande sentado en dos o más mesas que quiere una sola cuenta al final. Tóquelo en la mesa que ya tiene la orden en curso, elija cualquier mesa libre de la lista, y esa mesa ahora muestra el mismo par **View Bill**/**Merge In**, apuntando a la misma factura. Agregue tantas mesas como realmente ocupe el grupo.

**End of Day** (Fin del Día) es un botón en esta pantalla: marca cada mesa ocupada como disponible de nuevo y muestra un resumen de cierre de una línea (KOT servidos e ingresos de hoy), para que pueda cerrar el comedor al final de un turno.

## Reservas

Toque **Reservations** en la parte superior de Restaurant Tables para ver las reservas próximas y agregar nuevas — nombre del cliente, teléfono, tamaño del grupo, fecha/hora, una mesa opcional y una nota de texto libre (necesidades dietéticas, una ocasión especial, cualquier cosa que valga la pena saber al sentarlos). Una mesa con una reserva próxima en las siguientes horas muestra una pequeña insignia "Reserved 7:30 PM" directamente en su tarjeta, para que la vea de un vistazo al piso.

Cuando llega el grupo, toque **Seat** — esto marca la mesa como Ocupada y la reserva como Seated; la reserva en sí no crea una cuenta, así que use **Start Order** en la mesa normalmente cuando estén listos para pedir. **No-show** y **Cancel** cierran una reserva que no se concretó, sin tocar la mesa.

## Dividir una cuenta

Una vez que una orden está registrada pero antes de que se haya pagado algo, **Split Bill** en la pantalla de la factura la divide en dos o más cuentas separadas — elija cuántas cuentas, luego indique cuánto de cada artículo va en cada una (un artículo compartido, como un postre que dos personas están dividiendo, se puede dividir hasta la unidad individual). Cada cuenta se convierte en su propia factura real, facturada y pagada por separado desde ahí. La mesa permanece Ocupada, ahora apuntando a la primera cuenta, hasta que cada cuenta dividida esté realmente saldada. Dividir solo cambia cómo se paga la cuenta — la comanda de cocina original y el stock que ya descontó no se modifican.

## Propina / cargo por servicio y artículos "86"

En la pantalla de Facturación, use **Agregar propina / cargo por servicio** para añadir una línea de propina a una cuenta sin que esté vinculada a ningún artículo del menú específico ni se grave como producto.

En la pantalla de Productos, marque cualquier artículo del menú como **86** (jerga de cocina para "agotado por hoy") para ocultarlo instantáneamente del carrito de facturación y del menú QR de cara al cliente, sin desactivar el producto en sí — perfecto para un platillo que se agotó por el día pero que volverá al menú mañana.

## Comandas de Cocina (KOT)

Un KOT es la copia de cocina de un pedido. Después de registrar un pedido en **Facturación**, abra la factura y toque **Send to Kitchen** para crear un KOT para ella. Desde **Kitchen Order Tickets** en la barra lateral, el personal de cocina ve cada comanda agrupada por estado — Pending, In Progress, Done, Cancelled — con sus artículos y cantidades, y avanza cada una con un solo toque (**Start Cooking** → **Mark Done**), o la **Cancel** (cancela). Cada comanda también se puede imprimir directamente en su impresora de cocina.

Marcar un KOT como **Done** es lo que activa la deducción del stock de ingredientes (vea más abajo) y libera la mesa a la que pertenecía, una vez que ninguna otra comanda activa esté usando esa mesa.

## Opciones de hardware de cocina

Además de la pantalla de Kitchen Order Tickets dentro de la app, Sarang ofrece tres formas de poner las comandas frente al personal de cocina — las tres pueden funcionar a la vez (imprimir un ticket de papel, mostrar un monitor de pared y dejar que un teléfono o tableta lo controle no se excluyen entre sí). Configúrelas desde **Settings → Appearance**, solo para negocios de tipo restaurante.

**Kitchen Printer.** De forma predeterminada, imprimir un KOT va a la impresora predeterminada de Windows. Si su impresora de cocina es un dispositivo físico distinto de la impresora de recibos de su mostrador de facturación, selecciónela en el menú desplegable **Kitchen Printer** — a partir de entonces, cada trabajo de impresión de KOT va directamente allí, sin cuadro de diálogo de impresión, sin selección manual. Déjelo en "Use Windows default printer" si solo tiene una impresora.

**Kitchen Display — second monitor.** Convierte cualquier segundo monitor conectado a la PC de facturación en un tablero KOT en vivo, con texto grande (Pending / In Progress / Recently Done), operado con un mouse normal — no se necesita pantalla táctil. En **Kitchen Display — second monitor**, elija una pantalla detectada y toque **Open Kitchen Display**; se abre allí a pantalla completa y se actualiza automáticamente. Algunas notas de instalación física:
- El mouse solo necesita llegar a la PC, no a la pantalla — si la cocina está a más de un par de metros de la PC de facturación, use un **mouse inalámbrico** (su receptor USB se conecta a la PC de facturación) en lugar de uno con cable, ya que el cable de un mouse con cable no llegará hasta allí.
- El cable de video del monitor tiene el mismo problema de distancia, normalmente peor — un cable HDMI normal empieza a perder señal después de unos 10-15 metros. Si su cocina es una habitación separada o está al otro lado del restaurante (digamos 10-30 m, posiblemente a través de una pared), use un **kit extensor HDMI por Ethernet** (un par emisor/receptor económico conectado con un cable de red estándar) en lugar de un único cable HDMI largo.
- En la configuración de pantalla de Windows, asegúrese de que el segundo monitor esté configurado en **Extend these displays**, no en Duplicate — eso es lo que permite que el cursor de su mouse se mueva hacia él.
- Si tender un cable tan lejos resulta poco práctico, use en su lugar la opción de teléfono/tableta/laptop de abajo — no necesita ningún cableado.

**Kitchen Display — phone / laptop.** Permite que cualquier teléfono, tableta o laptop conectado al WiFi de su local abra un tablero KOT en vivo en su propio navegador — sin instalar ninguna app; una tableta apoyada en la cocina funciona exactamente igual que un teléfono o una laptop aquí. Actívelo en **Kitchen Display — phone / laptop**, luego lea en voz alta la(s) dirección(es) LAN mostrada(s) o toque **Show QR code** y haga que el dispositivo la escanee. Esto funciona completamente sobre su propia WiFi, sin necesidad de internet, y es completamente independiente de la función de pedidos por mesa con código QR de cara al cliente descrita abajo (servidor distinto, puerto distinto, y un código de acceso aleatorio que solo se muestra aquí, en Settings — un cliente que escanea el código QR de pedidos de su mesa no tiene forma de llegar al tablero de cocina). Si alguna vez necesita revocar el acceso (p. ej. se pierde un teléfono con el enlace), toque **Regenerate access code** — cada enlace/código QR compartido anteriormente deja de funcionar de inmediato.

## Recetas y seguimiento de ingredientes

Abra **Recipes** para vincular un artículo del menú (p. ej. "Masala Chai") con las materias primas que consume y cuánto de cada una — busque el producto del menú, nombre la receta, luego agregue filas de ingredientes (cada ingrediente solo puede aparecer una vez por receta; combine cantidades en lugar de agregar una fila duplicada). La lista de ingredientes de cada receta se muestra expandida en la vista de lista.

Una vez que existe una receta para un artículo del menú, completar su KOT (marcarlo como Done) deduce automáticamente las cantidades de ingredientes de la receta × la cantidad pedida de su stock de productos regular — no hay un inventario de ingredientes separado que mantener. Si el stock de un ingrediente no se puede ajustar por alguna razón, Sarang no pierde la discrepancia en silencio: genera una notificación indicándole qué ingrediente necesita un reconteo manual, de modo que sus números de stock nunca se desvíen silenciosamente.

Los artículos del menú sin receta configurada simplemente no deducen ningún stock de ingredientes al venderse — las recetas son totalmente opcionales por artículo.

## Pedidos por mesa con código QR (opcional)

Restaurant Tables también tiene un interruptor de **QR Table Ordering**, desactivado por defecto. Actívelo y Sarang inicia un pequeño servidor local en su propia red WiFi (sin necesidad de internet) para que los clientes puedan escanear el código QR impreso de una mesa, explorar el menú y enviar una solicitud de pedido desde su teléfono. Nada se convierte en una factura real automáticamente — cada pedido entrante aparece bajo **Incoming Orders** en la pantalla de Kitchen Order Tickets, donde el personal explícitamente lo **Accept** (elige un método de pago, lo que crea la factura y el KOT juntos) o lo **Reject**. El código QR de cada mesa se puede generar e imprimir desde su tarjeta en la pantalla de Restaurant Tables.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos. Si también activa Logística y Cadena de Suministro en **Configuración → Funciones Adicionales de Negocio**, obtiene también Flota, Transportistas, Envíos, GRN, Albarán de Entrega, Libro de Fletes y Análisis de Logística — pero esto no está activado por defecto para un restaurante, ya que la mayoría de los restaurantes no operan su propia flota de entrega ni reciben envíos formales de proveedores.
