# Restaurante

Elegir **Restaurante** como su tipo de negocio durante la configuración activa cuatro cosas además de las funciones universales que recibe todo negocio: **Mesas**, **Comandas de Cocina (KOT)**, **Recetas** y el seguimiento de stock de ingredientes. Facturación, Clientes, Inventario e Informes funcionan todos de la misma manera descrita en sus propios capítulos — este capítulo solo cubre lo específico de administrar un restaurante.

## Mesas

Abra **Mesas del Restaurante** desde la barra lateral para ver cada mesa que ha configurado, cada una mostrada como una tarjeta con su estado actual: **Libre** (Libre), **Ocupada** (Ocupada) o **Res** (Reservada). Agregue una mesa con un número de mesa (p. ej. "T1") y un nombre para mostrar opcional. Toque un botón de estado en la tarjeta de una mesa para cambiarlo manualmente — o deje que el estado de una mesa siga una orden real automáticamente, vea abajo. Una mesa no se puede eliminar mientras tenga una comanda de cocina activa. Asigne un **mesero** a una mesa desde su tarjeta para siempre saber quién la está atendiendo; borre la asignación en cualquier momento.

**Iniciar Pedido** en la tarjeta de una mesa libre abre Billing con esa mesa ya vinculada — arme el carrito como siempre y confirme la venta. La mesa ahora está realmente vinculada a esa cuenta: su tarjeta muestra **Ver Cuenta** (va directo a la factura) y **Combinar** en lugar de Start Order, y la mesa se libera automáticamente en cuanto la cuenta se paga por completo o se cancela — sin tener que recordar cambiar su estado a mano.

**Combinar** une una segunda mesa a la misma cuenta en curso — para un grupo grande sentado en dos o más mesas que quiere una sola cuenta al final. Tóquelo en la mesa que ya tiene la orden en curso, elija cualquier mesa libre de la lista, y esa mesa ahora muestra el mismo par **Ver Cuenta**/**Combinar**, apuntando a la misma factura. Agregue tantas mesas como realmente ocupe el grupo.

**Fin del Día** (Fin del Día) es un botón en esta pantalla: marca cada mesa ocupada como disponible de nuevo y muestra un resumen de cierre de una línea (KOT servidos e ingresos de hoy), para que pueda cerrar el comedor al final de un turno.

## Reservas

Toque **Reservas** en la parte superior de Restaurant Tables para ver las reservas próximas y agregar nuevas — nombre del cliente, teléfono, tamaño del grupo, fecha/hora, una mesa opcional y una nota de texto libre (necesidades dietéticas, una ocasión especial, cualquier cosa que valga la pena saber al sentarlos). Una mesa con una reserva próxima en las siguientes horas muestra una pequeña insignia "Reserved 7:30 PM" directamente en su tarjeta, para que la vea de un vistazo al piso.

Cuando llega el grupo, toque **Sentar** — esto marca la mesa como Ocupada y la reserva como Seated; la reserva en sí no crea una cuenta, así que use **Iniciar Pedido** en la mesa normalmente cuando estén listos para pedir. **No se presentó** y **Cancelar** cierran una reserva que no se concretó, sin tocar la mesa.

## Dividir una cuenta

Una vez que una orden está registrada pero antes de que se haya pagado algo, **Dividir Cuenta** en la pantalla de la factura la divide en dos o más cuentas separadas — elija cuántas cuentas, luego indique cuánto de cada artículo va en cada una (un artículo compartido, como un postre que dos personas están dividiendo, se puede dividir hasta la unidad individual). Cada cuenta se convierte en su propia factura real, facturada y pagada por separado desde ahí. La mesa permanece Ocupada, ahora apuntando a la primera cuenta, hasta que cada cuenta dividida esté realmente saldada. Dividir solo cambia cómo se paga la cuenta — la comanda de cocina original y el stock que ya descontó no se modifican.

## Propina / cargo por servicio y artículos "86"

En la pantalla de Facturación, use **Agregar propina / cargo por servicio** para añadir una línea de propina a una cuenta sin que esté vinculada a ningún artículo del menú específico ni se grave como producto.

En la pantalla de Productos, marque cualquier artículo del menú como **86** (jerga de cocina para "agotado por hoy") para ocultarlo instantáneamente del carrito de facturación y del menú QR de cara al cliente, sin desactivar el producto en sí — perfecto para un platillo que se agotó por el día pero que volverá al menú mañana.

## Precios de Combo / Thali

Cree un combo o thali como un artículo de menú igual que cualquier otro producto, luego ábralo para editar y use **Manage Kit Components** para agregar los platos individuales que lo componen y cuántos de cada uno. Establezca el precio de venta propio del combo en el producto mismo — es completamente independiente de lo que costarían los platos individuales por separado, de modo que un thali se pueda cotizar como una oferta combinada real, no la suma de sus partes. Vender un combo lo factura como una sola línea limpia, pero por debajo deduce correctamente el stock de cada plato que contiene, y marcar su ticket de cocina como **Mark Done** deduce correctamente también los ingredientes detrás de esos platos — igual que si cada plato se hubiera pedido por separado.

## Precios de Happy Hour

Para tener un happy hour — por ejemplo, 20% de descuento en bebidas de 4 a 6 p. m. — no se necesita una función especial de restaurante: cree un Esquema de Precios **Happy Hour / % de Descuento Fijo** (Esquemas de Precios, vea el capítulo Órdenes de Venta y Precios) restringido a la categoría de bebidas o a un solo artículo, y asígnele una hora de inicio y fin diaria junto con el descuento. Se aplica automáticamente en el checkout solo durante esa ventana y se desactiva por sí solo en cuanto termina la ventana — nadie tiene que acordarse de activar o desactivar un descuento manualmente.

## Comandas de Cocina (KOT)

Un KOT es la copia de cocina de un pedido. Después de registrar un pedido en **Facturación**, abra la factura y toque **Enviar a Cocina** para crear un KOT para ella. Desde **Kitchen Order Tickets** en la barra lateral, el personal de cocina ve cada comanda agrupada por estado — Pending, In Progress, Done, Cancelled — con sus artículos y cantidades, y avanza cada una con un solo toque (**Start Cooking** → **Mark Done**), o la **Cancelar** (cancela). Cada comanda también se puede imprimir directamente en su impresora de cocina.

Marcar un KOT como **Completado** es lo que activa la deducción del stock de ingredientes (vea más abajo) y libera la mesa a la que pertenecía, una vez que ninguna otra comanda activa esté usando esa mesa.

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

Abra **Recetas** para vincular un artículo del menú (p. ej. "Masala Chai") con las materias primas que consume y cuánto de cada una — busque el producto del menú, nombre la receta, luego agregue filas de ingredientes (cada ingrediente solo puede aparecer una vez por receta; combine cantidades en lugar de agregar una fila duplicada). La lista de ingredientes de cada receta se muestra expandida en la vista de lista.

Una vez que existe una receta para un artículo del menú, completar su KOT (marcarlo como Done) deduce automáticamente las cantidades de ingredientes de la receta × la cantidad pedida de su stock de productos regular — no hay un inventario de ingredientes separado que mantener. Si el stock de un ingrediente no se puede ajustar por alguna razón, Sarang no pierde la discrepancia en silencio: genera una notificación indicándole qué ingrediente necesita un reconteo manual, de modo que sus números de stock nunca se desvíen silenciosamente.

Los artículos del menú sin receta configurada simplemente no deducen ningún stock de ingredientes al venderse — las recetas son totalmente opcionales por artículo.

## Informes

Abra **Informes → Margen de Contribución por Plato** para ver, por cada plato vendido en un rango de fechas, sus ingresos menos su costo de receta — un gráfico de barras más una tabla completa, ordenados para que sus platos con mejor margen queden arriba. Esta es una pregunta diferente a **Informes → Informe de Costo de Alimentos**: el Costo de Alimentos totaliza lo que realmente gastó en ingredientes este período, mientras que el Margen de Contribución responde "qué platos realmente están cubriendo su costo", usando la fórmula de receta propia de cada plato en lugar del gasto agregado. El margen de un combo o thali refleja correctamente las recetas de los platos reales que contiene, y un artículo de menú sin receta configurada simplemente muestra 0 de costo de ingredientes — un "sin datos" honesto, no una suposición.

Abra **Informes → Rotación de Mesas por Hora** para ver un mapa de calor de día de la semana × hora del día de sus pedidos en mesa en un rango de fechas — cuanto más oscura una celda, más ocupado estuvo realmente su restaurante durante esa hora, en ese día de la semana. Aquí solo cuentan los pedidos realmente iniciados desde una mesa (mediante **Start Order** en Restaurant Tables); una venta de mostrador o para llevar sin mesa asociada no forma parte de la pregunta de "rotación de mesas" y queda correctamente excluida. Úselo para ver sus horas pico reales de un vistazo, no una suposición basada en la memoria — útil para programar los turnos del personal según cuándo el local está realmente más ocupado.

Abra **Informes → Variación de Desperdicio: Receta vs. Real** para comparar, por ingrediente, cuánto deberían haberse usado según sus recetas frente a lo que realmente se retiró del stock en un rango de fechas — un gráfico de barras más una tabla completa, con las mayores brechas primero. Un ingrediente que consistentemente supera lo que indican sus recetas es una señal real que vale la pena revisar — porciones excesivas, derrames, o una receta desactualizada — mientras que un ingrediente por debajo puede significar lo contrario. Esto es genuinamente diferente de los dos informes anteriores: Costo de Alimentos y Margen de Contribución muestran cada uno un lado de la historia (gasto real, o costo según receta); este es el único informe que pone ambos lados del MISMO ingrediente uno junto al otro.

## Pedidos por mesa con código QR (opcional)

Restaurant Tables también tiene un interruptor de **Pedidos por QR en Mesa**, desactivado por defecto. Actívelo y Sarang inicia un pequeño servidor local en su propia red WiFi (sin necesidad de internet) para que los clientes puedan escanear el código QR impreso de una mesa, explorar el menú y enviar una solicitud de pedido desde su teléfono. Nada se convierte en una factura real automáticamente — cada pedido entrante aparece bajo **Incoming Orders** en la pantalla de Kitchen Order Tickets, donde el personal explícitamente lo **Aceptar** (elige un método de pago, lo que crea la factura y el KOT juntos) o lo **Rechazar**. El código QR de cada mesa se puede generar e imprimir desde su tarjeta en la pantalla de Restaurant Tables.

### QR para unirse al WiFi (combinado con el QR de pedidos)

Dado que el teléfono de un cliente necesita estar en el WiFi de su restaurante para siquiera llegar a la página de pedidos, la tarjeta de **Red WiFi** (se muestra en cuanto Pedidos por QR en Mesa está activado) le permite guardar el nombre y la contraseña de su red para invitados una sola vez. Después de eso, el código QR de cada mesa muestra — e imprime — un segundo código QR encima del código QR de pedidos: escanéelo para unirse al WiFi automáticamente, luego escanee el código QR de pedidos justo debajo para explorar el menú y pedir. Sin escribir contraseñas, sin un cartel de WiFi aparte junto a la mesa.

Esto es completamente opcional — deje la tarjeta de Red WiFi sin configurar y los códigos QR de las mesas funcionan exactamente como antes (solo el código QR de pedidos). Editar la red más adelante (p. ej. después de cambiar la contraseña de su router) es tan simple como volver a guardarla; dejar el campo de contraseña en blanco mientras solo actualiza el nombre de la red conserva la contraseña existente en lugar de borrarla. Marcar la red como **abierta** (sin contraseña) omite por completo el campo de contraseña — útil si su WiFi para invitados no tiene contraseña propia.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos. Si también activa Logística y Cadena de Suministro en **Configuración → Funciones Adicionales de Negocio**, obtiene también Flota, Transportistas, Envíos, GRN, Albarán de Entrega, Libro de Fletes y Análisis de Logística — pero esto no está activado por defecto para un restaurante, ya que la mayoría de los restaurantes no operan su propia flota de entrega ni reciben envíos formales de proveedores.
