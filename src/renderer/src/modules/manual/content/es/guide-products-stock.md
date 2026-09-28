# Guía: Productos, categorías y stock

Cómo configurar lo que vendes, mantener el stock correcto, y averiguar por qué un número es el que es.

## 1. Primero las categorías (2 minutos, ahorra horas)

Las categorías agrupan productos para filtrar e informar (por ejemplo *Bombillas*, *Interruptores*, *Cable*).

- **Inventory → Productos → botón Categoría** abre **Manage Categories**: agregar, renombrar, agregar una subcategoría o archivar.
- **Agregar rápido al crear un producto**: en el formulario del producto, elige **+ Create new category…**, escribe el nombre (y uno principal si es una subcategoría) y se crea y selecciona de inmediato.

## 2. Agrega un producto

**Inventory → Productos → Add Product.**

| Campo | Qué escribir |
|---|---|
| Nombre del producto | Cómo lo llaman tú y tus clientes |
| SKU / Código de barras | Tu propio código, o escanea el código del fabricante |
| Código HSN | El código de clasificación de la mercancía que te da tu contador (los servicios usan SAC) |
| Tipo de producto | **Standard** (se cuenta el stock) o **Service** (sin stock, por ejemplo mano de obra) |
| Unidad | PCS, KG, L, M, BOX, etcétera |
| Precio de costo | Lo que pagas por unidad, **antes de impuesto** (el costo del stock nunca incluye el impuesto de compra) |
| Precio de venta | Lo que cobras por unidad. Antes de impuesto por defecto; con impuesto incluido si activas **Prices include tax** |
| MRP | El precio máximo impreso, si lo hay (se muestra tachado junto a tu precio) |
| Tasa de impuesto % | La tasa de GST de este producto. Escríbela, o haz clic en una tasa de **Settings → Tax Configuration** |
| Nivel / cantidad de reorden | El nivel de stock que genera una alerta de stock bajo, y cuánto sueles pedir |
| Cantidad inicial | El stock que ya tienes al agregar el producto |

**Los precios son antes de impuesto salvo que digas otra cosa.** Por defecto Sarang agrega el impuesto al vender o comprar: un precio de venta de 100 con 18 por ciento de impuesto se vende en 118. Si tu precio de estantería ya incluye el impuesto, activa **Prices include tax** (en Settings, o el interruptor en cada documento) y Sarang calcula el impuesto hacia atrás, así no tienes que dividir a mano. Consulta *Guía: Impuestos y GST*.

El impuesto que fijas aquí se completa automáticamente en facturas, cotizaciones, órdenes de venta, órdenes de compra, facturas de proveedor y notas de débito al elegir el producto. Aun así puedes cambiarlo en una línea individual.

Las variantes (tamaño y color), la venta por peso, los lotes con vencimiento, los números de serie o IMEI, y los kits (varios productos vendidos como uno) se activan según tu tipo de negocio o en **Settings → Additional Business Features**.

## 3. Haz que entre stock

El stock sube **solo** cuando ocurre uno de estos:

1. **Receive Stock** en una Orden de compra aprobada.
2. Un **GRN** con la línea vinculada a un producto se **Publica (Posted)**.
3. **Cantidad inicial** al crear el producto por primera vez.
4. Un **ajuste de stock** (abajo).
5. Una **Devolución de venta** que recibe mercancía de vuelta, o una **corrida de producción** termina (fabricantes).

Una **Factura del proveedor** por sí sola nunca agrega stock. Consulta *Guía: Comprar a proveedores*.

## 4. Haz que salga stock

El stock baja al confirmar una venta en Facturación (o al facturar una Orden de venta), cuando una **Nota de débito** devuelve mercancía, cuando se usa en producción, o cuando lo ajustas hacia abajo.

Sarang no te dejará vender más de lo que tienes. Si una venta se bloquea con *Insufficient stock*, recibe primero la compra o corrige el conteo de stock con un motivo. Si de verdad necesitas vender antes de que la mercancía esté registrada, activa el stock negativo en **Settings → Business Features → Stock rules**; la cantidad se muestra entonces por debajo de cero hasta que recibas la mercancía.

## 5. Revisa y corrige el stock

- **Inventory** lista cada producto con su cantidad actual, nivel de reorden, costo promedio y valor de stock. La pestaña **Low Stock** muestra qué hay que pedir.
- **Ajustar stock**: haz clic en el ícono de ajuste de una fila e ingresa la **nueva cantidad** (no la diferencia). Da un motivo (daño, conteo, saldo inicial). Al aumentar el stock puedes registrar el costo de las unidades agregadas.
- **Movements** (botón en Inventory) es un historial de solo lectura de cada cambio: Stock Added, Sale, PO Received, Adjustment, Sale Return y más. Úsalo para responder "¿por qué este número es el que es?".
- **Contar stock**: **Inventory → Stock Counts → New count**. Sarang toma una foto de lo que cree que tienes de cada artículo; tú escribes lo que contaste de verdad, y muestra la diferencia y su valor. Nada cambia hasta que presionas **Post**, que convierte cada diferencia en un ajuste de stock (motivo: conteo de stock) en tu ubicación principal. Solo puede haber un conteo abierto a la vez. Los artículos con lotes, número de serie o vencimiento se cuentan solo por cantidad total. Si la publicación se interrumpe, el conteo sigue abierto y las líneas ya publicadas quedan publicadas: presiona Post otra vez para terminar el resto. **Reports → Stock Count Variances** muestra qué faltó o sobró.
- **Stock Locations**: mantén stock separado para tienda, depósito o furgoneta, y muévelo entre ellos.
- **Bin Locations**: **Inventory → Bin Locations** registra en qué estante, rack o casillero (por ejemplo A-3-2) está cada artículo dentro de una ubicación, para que cualquiera lo encuentre. Es una etiqueta escrita a mano: un casillero por artículo por ubicación, y aparece solo en esta pantalla (todavía no en informes ni listas impresas).
- **Stock Journal**: **Inventory → Stock Journal** registra mercancía que cambia de forma, como partir una caja en paquetes: elige qué sale y qué entra y guárdalo junto. El valor que sale se reparte entre los artículos que entran según la cantidad. No se puede editar ni revertir una vez guardado: corrige un error con un asiento opuesto.
- **Prometido en pedidos**: **Inventory** y el informe Stock Summary muestran, junto a cada artículo, cuánto está prometido en Órdenes de venta abiertas. Es un recordatorio, no un bloqueo: nada te impide vender stock prometido.

## 6. Reordena antes de quedarte sin stock

- Fija un **Nivel de reorden** en cada producto.
- Vigila los mosaicos de stock bajo en el **Dashboard** y las alertas de la campana. Una alerta de stock bajo abre **Inventory** al hacer clic.
- En la pantalla **Inventory**, **Generate Reorder POs** crea órdenes de compra en borrador para todo lo que esté por debajo de su nivel de reorden, usando el proveedor predeterminado de cada producto (fija un proveedor predeterminado en el producto primero).

## 7. ¿Cuánto vale mi stock?

**Inventory** muestra el valor de cada producto (cantidad x costo promedio). **Reports → Stock Summary**, **Stock Ledger** (cada movimiento con apertura y cierre), **Inventory Ageing** y los informes de stock por ubicación y transferencia muestran valoración, movimiento y cuánto tiempo llevan los artículos sin moverse. La valoración sigue el método que usas (promedio, FIFO y otros donde esté activado) y cada informe dice que es a fecha de hoy. Los costos de flete o aranceles ingresados como **costo de importación (landed cost)** en una compra elevan el costo de esos artículos.

## Errores comunes

| Error | Qué pasa | Solución |
|---|---|---|
| Escribir un artículo nuevo en un GRN sin vincularlo | El stock no sube | Usa **+ Create product and link** en la línea antes de publicar |
| Ingresar un precio de venta con impuesto incluido mientras Prices include tax está apagado | A los clientes se les cobra el impuesto dos veces | Activa **Prices include tax**, o ingresa el precio antes de impuesto |
| Tasa de impuesto dejada en 0 | Falta el impuesto en los documentos | Fija la tasa en el producto |
| Ajustar el stock por la diferencia | Cantidad incorrecta | Ingresa la cantidad **nueva total** |
| Eliminar un producto con historial | No permitido | Archívalo en su lugar |

**Imprimir etiquetas de estantería y de envío.** **Inventory → Print Labels** imprime etiquetas de artículo; un envío tiene **Print labels** y **Track**, que muestra su propia línea de tiempo de despachos, retrasos y entrega que tú mismo actualizas (no hay un rastreo en vivo del transportista).
