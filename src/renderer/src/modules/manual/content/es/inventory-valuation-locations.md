# Valoración de Inventario y Stock Multi-Ubicación

## Método de Valoración

Ahora cada producto tiene un **Método de Valoración**, configurado en el formulario del producto: **Promedio Ponderado** (predeterminado — el costo que ves es un promedio corriente a lo largo de cada compra), **FIFO** (Primero en Entrar, Primero en Salir — el costo refleja tus capas de compra más antiguas que aún tienes en stock), o **Costo Estándar** (un costo fijo que tú mismo defines, que no cambia con los precios de compra). Sea cual sea el método que use un producto, esa es la cifra de costo que Sarang usa en todos los lugares donde el costo importa para ese producto — el margen en el Panel de Control, el informe de Pérdidas y Ganancias, el informe de Costo de Alimentos, y las sugerencias de borrador de reorden leen todos la misma cifra de costo resuelta, por lo que nunca discrepan entre sí.

Cambiar el método de valoración de un producto no reescribe su historial de compras — solo cambia qué cifra lee Sarang de aquí en adelante.

## Ubicaciones y Transferencia de Stock

**Ubicaciones** (`/locations`) es para negocios que almacenan stock en más de un lugar — un almacén más un mostrador de venta al público, o dos sucursales. Todo negocio comienza con una única ubicación predeterminada "Principal" a la que ya pertenece todo el stock existente, por lo que nada cambia hasta que realmente agregues una segunda. Agrega una ubicación con **Nueva Ubicación** (nombre y una dirección opcional); la primera ubicación creada siempre es la predeterminada, y una ubicación predeterminada no se puede desactivar ya que todo movimiento de stock que no especifique una ubicación concreta va allí.

Una vez que existe una segunda ubicación, aparece una acción **Transferir Stock**: elige un producto, una cantidad, una ubicación de origen y destino, y un motivo opcional. Una transferencia solo mueve stock entre ubicaciones — nunca cambia cuánto tienes en total, por lo que no crea un nuevo movimiento de inventario del tipo "stock agregado" o "stock eliminado", solo un cambio de ubicación a ubicación.

## Costo de Desembarque

**Costo de Desembarque** te permite incorporar costos adicionales del lado de la compra — flete, aranceles aduaneros, manejo, o cualquier otra cosa — al costo real de un producto, en lugar de dejarlos como un gasto separado y sin atribuir.

En una **Orden de Compra**, agrega un costo de desembarque desde su pantalla de detalle: elige un tipo (Flete, Arancel, Manejo, u Otro), un importe, y cómo distribuirlo entre las líneas de la orden — **por valor de línea** (una línea de mayor valor de la orden absorbe una parte mayor del costo) o **por cantidad** (se distribuye equitativamente por unidad sin importar el precio). Puedes agregar o quitar costos de desembarque libremente hasta que la OC se reciba por primera vez; una vez que comienza la recepción, quedan bloqueados, ya que el historial de costos al que alimentan nunca se reescribe después. En una **Factura de Compra**, los costos de desembarque se ingresan en línea solo al momento de la creación, en una sección opcional — una Factura de Compra publica su historial de costos de inmediato, sin un paso separado de "recepción" para agregar costos después.

De cualquier manera, el costo de desembarque se incorpora al costo por unidad registrado para esa compra, que es exactamente lo que tu método de valoración (arriba) lee después.

## Artículos Compuestos (Kits)

Un **Kit** es un producto compuesto por otros productos, que se vende y almacena como un solo artículo pero cuyo precio e inventario se determinan a través de sus componentes reales. Convierte un producto en un kit desde su propio formulario: marca **Este es un Kit** y elige sus componentes (cada uno debe ser un producto Estándar real, con stock — los servicios y otros kits no se pueden agregar como componente, ya que el stock de un kit debe poder rastrearse hasta algo que realmente está en un estante).

Cuando vendes un kit, la factura sigue mostrando una sola línea al precio propio del kit — nada cambia para el cliente o el cajero. Detrás de escena, Sarang verifica que cada componente tenga suficiente stock antes de permitir la venta, luego descuenta la cantidad real de cada componente, por lo que tus conteos de stock a nivel de componente siempre se mantienen precisos aunque lo que se vendió fue el kit.

## PO Automática por Nivel de Reorden

El **Nivel de Reorden** de cada producto ya existe para activar alertas de stock bajo (ver el capítulo de *Inventario*); ese mismo umbral ahora también impulsa la **generación de Órdenes de Compra en borrador**. Desde la pantalla de Inventario, generar borradores de reorden agrupa cada producto por debajo del umbral según su proveedor habitual y crea una OC en Borrador por proveedor, prellenada con una cantidad de reorden sugerida y el costo resuelto actual del producto — de todos modos revisas y apruebas cada una antes de que se vuelva real, nada se envía automáticamente a un proveedor.

## Conversión de Unidad Flotante (GRN)

Algunos productos comprados no se convierten a tu unidad de venta en una proporción perfectamente fija — una "bolsa de arroz" puede pesar nominalmente 25 kg, pero la bolsa que realmente recibes puede pesar 24.6 kg. Activa **Conversión de Unidad Flotante** en un producto (junto con su configuración de venta por paquete/peso existente) para capturar esto en el momento de la recepción: en un **GRN** (Nota de Recepción de Mercancía), aparece un campo de **Cantidad de Unidad de Compra** junto a esa línea — ingresa cuántas bolsas recibiste, mientras que el campo existente **Recibido** sigue siendo la cantidad real y medida que efectivamente se tomó en stock. Se permite que ambos difieran; Sarang deriva el factor de conversión real para esa recepción específica a partir de los dos números que ingresaste, en lugar de asumir que cada bolsa pesaba exactamente 25 kg.
