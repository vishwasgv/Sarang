# Código de Barras y Facturación Suelta/por Peso

La generación de códigos de barras, la impresión de etiquetas de código de barras y la facturación suelta/por peso son funciones opcionales para negocios que venden productos (minoristas, farmacias, tiendas generales y similares). Las tres están desactivadas por defecto para todo tipo de negocio — nada cambia en la forma en que factura hasta que las active.

## Activarlas

Vaya a **Configuración → Código de Barras y Facturación Suelta** y active las funciones que necesite, independientemente unas de otras:

- **Generación y Escaneo de Código de Barras** — genera automáticamente códigos de barras para los productos y habilita el escaneo de códigos de barras al momento de facturar y en la búsqueda de stock.
- **Impresión de Etiquetas de Código de Barras** — le permite imprimir etiquetas de código de barras + precio, ya sea en una impresora térmica de etiquetas o en una impresora normal A4/carta.
- **Facturación Suelta / por Peso** — le permite vender un producto por peso (p. ej. por kg) en lugar de, o junto con, un precio fijo por paquete.

Desactivar cualquiera de estas funciones más tarde no afecta a los códigos de barras existentes ni a los productos con facturación suelta ya configurados.

## Configurar un producto para vender por peso

En el formulario de edición del producto (**Productos**), marque **Vender por Peso**, luego elija una unidad (kg, g, L o mL) y establezca el **Precio por Unidad** (p. ej. ₹80 por kg). Un producto se vende en paquetes fijos a su precio de venta normal, o se vende suelto por peso a este precio por unidad — no ambos a la vez.

## Generar códigos de barras

Con la Generación de Código de Barras activada, editar un producto existente sin código de barras muestra un botón **Generar** junto al campo de Código de Barras — haga clic en él para asignar uno de inmediato. Los productos nuevos reciben un código de barras automáticamente al guardar si usted no escribió uno. Los códigos de barras generados internamente son códigos EAN-13 estándar de 13 dígitos que cualquier escáner ordinario puede leer, usando un rango de números reservado que los códigos de barras de fabricantes reales nunca usan, de modo que nunca pueden coincidir con el código de un producto escaneado.

Si activó los códigos de barras después de ya tener productos en el sistema, vaya a **Configuración → Código de Barras y Facturación Suelta → Generar Códigos de Barras Faltantes** para asignar un código de barras a cada producto que aún no tenga uno, con un solo clic — es seguro ejecutarlo más de una vez, ya que nunca toca un producto que ya tiene un código de barras.

## Imprimir etiquetas

Abra **Imprimir Etiquetas** (accesible una vez que la Impresión de Etiquetas de Código de Barras está activada). Busque o escanee un producto para agregarlo al lote de etiquetas, configure cuántas copias de cada etiqueta necesita (hasta 500 por línea), elija **Hoja A4 / Carta** o **Impresora Térmica de Etiquetas** como salida, luego **Vista Previa** o **Imprimir** directamente. Si algún producto del lote todavía no tiene código de barras, Sarang le indica cuáles y se detiene — genere un código de barras para ellos primero (desde la pantalla de Productos o el llenado masivo mencionado arriba).

El tamaño físico de la etiqueta térmica (ancho y alto en milímetros) se configura una vez bajo **Configuración → Código de Barras y Facturación Suelta → Tamaño de Etiqueta Térmica** para que coincida con las etiquetas de su impresora; no afecta la impresión en hoja A4.

## Pesar e imprimir un artículo suelto

En la misma pantalla de **Imprimir Etiquetas**, bajo **Pesar e Imprimir un Artículo Suelto**: busque un producto con facturación suelta, péselo en cualquier balanza, ingrese el peso en gramos y haga clic en **Imprimir Etiqueta**. Sarang calcula el precio para ese peso exacto e imprime una etiqueta única con un código de barras especial que codifica tanto el producto como la cantidad pesada. Escanear esa etiqueta al facturar la agrega a la cuenta en un solo escaneo, ya con el precio correcto — sin necesidad de ingresar el peso manualmente en la caja.

Si reimprime una etiqueta para el mismo producto con exactamente el mismo peso después de que su precio haya cambiado, Sarang le advierte en pantalla para que pueda ir a buscar y quitar la etiqueta física antigua — de lo contrario, una etiqueta física antigua escaneada más tarde cobraría el precio desactualizado sin forma de distinguirla de una nueva.

## Vender artículos sueltos en el mostrador

En **Facturación**, puede escanear una etiqueta de peso impresa (se agrega al carrito instantáneamente con su precio y peso impresos) o buscar un producto con facturación suelta por nombre y agregarlo manualmente — se agrega con una cantidad inicial de 1 de su unidad configurada, que luego ajusta a la cantidad realmente pesada antes de finalizar la venta. Si el precio impreso de una etiqueta escaneada ya no coincide con el precio actual del producto, Sarang de todos modos cobra lo que está impreso en la etiqueta (ya que eso es lo que ve el cliente), pero muestra una advertencia para que sepa que debe reimprimir las etiquetas restantes con el nuevo precio.

Escanear la misma etiqueta física exacta dos veces en una misma factura se marca con una advertencia (por si fue un doble escaneo accidental), aunque igualmente se agrega — vender genuinamente dos paquetes idénticamente pesados del mismo artículo es un escenario real que el sistema permite.
