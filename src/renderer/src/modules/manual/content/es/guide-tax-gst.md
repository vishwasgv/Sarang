# Guía: Impuestos y GST, cómo los calcula Sarang

Sarang calcula el impuesto de la misma manera en cada documento, y te muestra las mismas cifras en la pantalla, en el documento guardado, en la impresión, en el libro mayor y en los informes. Esta guía explica las reglas, cómo configurarlas, y dónde ver los totales. Es una guía de trabajo para tus propios registros. La ley fiscal cambia y depende de tu situación, así que confirma tus tasas y declaraciones con tu contador o CA.

## Dos formas de ingresar precios

Cada precio en Sarang (precio de costo, precio de venta, costo unitario) es **antes de impuesto** o **con impuesto incluido**, y cada documento indica cuál.

- **Antes de impuesto (el predeterminado para India):** Sarang añade el impuesto encima.
- **Con impuesto incluido:** el precio que escribes ya contiene el impuesto, como en una etiqueta de estante o un MRP. Sarang calcula el impuesto hacia atrás.

Elige la forma en que sueles fijar precios en **Settings → Currency & Locale → Prices include tax**. Esa se convierte en la elección inicial para cada documento nuevo. En cada documento (factura, cotización, orden de venta, orden de compra, factura de proveedor, nota de crédito, nota de débito) hay un interruptor **Prices include tax**, y la columna de precio dice **(excl. tax)** o **(incl. tax)**, así que nunca es ambiguo. Cambiar el interruptor convierte los precios que ingresaste para que el cliente pague lo mismo. En la pantalla de Facturación el interruptor queda bloqueado mientras el carrito tiene artículos, así una factura nunca mezcla ambas formas.

### La aritmética

Antes de impuesto:

```
monto de línea    = cantidad x precio
valor imponible    = monto de línea - descuento
impuesto           = valor imponible x tasa de impuesto
total de línea      = valor imponible + impuesto
```

Ejemplo: 2 unidades a 500, descuento 100, impuesto 18 por ciento. Monto de línea 1,000. Valor imponible 900. Impuesto 162. Total 1,062.

Con impuesto incluido:

```
monto de línea    = cantidad x precio          (ya incluye el impuesto)
tras descuento     = monto de línea - descuento
valor imponible     = tras descuento / (1 + tasa)
impuesto            = tras descuento - valor imponible
```

Ejemplo: 1 unidad con precio 118 incluyendo 18 por ciento de impuesto. Valor imponible 100. Impuesto 18. Total 118.

En ambas formas el impuesto se calcula sobre el valor **después del descuento**, un descuento a nivel de documento se reparte de forma justa entre las líneas, y la última línea toma el paisa sobrante para que las líneas siempre sumen el total. El subtotal, el descuento, el impuesto y el total son unidades enteras de tu moneda (paisa, centavos, fils) sin decimales perdidos.

### Redondear el total

**Settings → Currency & Locale → Invoice rounding** elige cómo se redondea el total a pagar: **None**, **nearest 0.05**, **0.10**, **0.50** o **1**. Los negocios en rupia india empiezan en "nearest 1"; cualquier otra moneda empieza en "None". El redondeo se muestra como su propia línea en la factura. Las notas de crédito y débito nunca se redondean de esta manera.

## Fija la tasa de impuesto una vez, en el producto

**Inventory → Productos →** ese producto **→ Tax Rate %**. Escribe una tasa o haz clic en una de tus tasas guardadas. Luego se completa en facturas, cotizaciones, órdenes de venta, órdenes de compra, facturas de proveedor y notas de débito al elegir el producto. Aun así puedes cambiar la tasa en una sola línea. Si la tasa que escribes no es una de tus tasas guardadas, Sarang muestra una advertencia suave para detectar un error de escritura como 81 en vez de 18.

Elige también la **Tax category** del producto: **Standard**, **Reduced**, **Zero-rated**, **Exempt**, **Nil-rated** u **Out of scope**. La categoría se recuerda en cada línea de documento y determina el Tax Report y las filas de GSTR-1 para suministros nil-rated, exempt y non-GST. Una línea que realmente cobra impuesto nunca puede declararse como exempt o nil-rated.

## Tasas de GST en India

Las tasas de GST cambiaron el 22 de septiembre de 2025. Las tasas vigentes ahora son **5 por ciento**, **18 por ciento** y **40 por ciento** (una lista corta de bienes de lujo y "pecaminosos"), más **nil**, con tasas especiales de **3 por ciento** (oro, plata, joyería) y **0.25 por ciento** (diamantes en bruto). Las tasas de 12 y 28 por ciento fueron retiradas. Sarang las ofrece como tasas guardadas y mantiene tus antiguas tasas de 12 y 28 por ciento visibles bajo **Older rates (before 22 Sep 2025)** en **Settings → Tax Configuration**, para que los registros antiguos sigan teniendo sentido. Qué tasa aplica a un artículo depende de su código HSN: pregunta a tu CA y fíjala en el producto. Los documentos antiguos conservan la tasa con la que se hicieron; cambiar la tasa de un producto nunca cambia documentos pasados.

## Cómo se muestra el impuesto: CGST + SGST, IGST, o GST

Para un negocio con GST, cada documento fiscal tiene una elección **Tax shown as**:

| Elección | Úsala cuando | Qué se imprime |
|---|---|---|
| **CGST + SGST** | El comprador está en el mismo estado | Dos líneas iguales (para 18 por ciento, 9 más 9) |
| **IGST** | El comprador está en otro estado | Una línea IGST |
| **GST** | Quieres una sola línea combinada | Una línea llamada GST |

Sarang elige por ti comparando el estado de tu negocio con el del cliente (o, en compras, el del proveedor), y puedes cambiarlo en el documento. Si el cliente no tiene un estado guardado pero tiene GSTIN, se usan los dos primeros dígitos del GSTIN (el código de estado). Si ninguno se conoce, Sarang usa CGST + SGST.

**El monto del impuesto y el total son exactamente los mismos en las tres opciones.** Solo cambia la forma en que se muestra el mismo monto. Cuando un monto no se divide de forma pareja, las dos mitades difieren como máximo en un paisa y siempre suman de vuelta el impuesto completo. En los informes, un documento mostrado como una sola línea de GST se clasifica como CGST + SGST o IGST según su lugar de suministro, y el informe advierte cuántos documentos no tenían estado.

## Notas de crédito y débito: agregar impuesto u omitirlo

Cada nota de crédito y débito tiene **Add tax to this note**. Empieza activada cuando la factura, orden de compra o factura vinculada llevaba impuesto, y desactivada en caso contrario; puedes cambiarla.

- **Omitir impuesto:** el total de la nota es igual al monto; no se imprimen líneas de impuesto; el saldo del cliente o proveedor se mueve solo por ese monto.
- **Agregar impuesto:** una nota hecha con artículos usa la tasa de impuesto de cada línea; una nota de monto simple pide una tasa de impuesto y trata el monto como antes de impuesto o con impuesto incluido según la propia configuración de precio de la nota. El impuesto se muestra como CGST + SGST, IGST o GST, igual que cualquier otro documento.

Si omites el impuesto en una nota vinculada a un documento que cobró impuesto, Sarang te advierte que el impuesto que cobraste antes no se revertirá; aun así puedes continuar. El Tax Report, GSTR-1 y GSTR-3B incluyen el impuesto de una nota solo cuando fue agregado.

## Casos especiales

| Situación | Qué hacer |
|---|---|
| El cliente está exento de impuesto | Marca al cliente como exento de impuesto en su página e ingresa el número del certificado de exención y la fecha hasta la que es válido. Sus facturas no llevan impuesto mientras el certificado sea válido; después de esa fecha Sarang cobra impuesto de nuevo y el formulario del cliente muestra una advertencia |
| Venta a un cliente en otro país (exportación) | En la pantalla de Facturación marca **Export sale?** (aparece cuando el país del cliente es distinto al tuyo). La venta queda entonces zero-rated. Sarang nunca hace esto por sí solo; revisa las reglas de exportación y guarda prueba de la exportación |
| Tu negocio está bajo el Composition Scheme | **Settings → Business Profile → GST Scheme → Composition Scheme.** Las ventas se emiten entonces como Bill of Supply sin impuesto por separado |
| Una compra donde **tú** pagas el impuesto (reverse charge) | Marca **Reverse Charge** en la factura del proveedor o gasto. El impuesto se registra como tu propia obligación en lugar de parte de lo que debes al proveedor |
| Cliente o proveedor extranjero | Usa la opción de moneda extranjera en el documento; los montos mantienen los propios decimales de tu moneda |
| Una muestra gratis o artículo de promoción | Usa **Give free** en la línea, o deja que un esquema de precios agregue líneas como "compra 2 lleva 1 gratis". El stock sale; precio e impuesto son cero |
| Entrega, embalaje u otros cargos | **Add Charge** en la pantalla de Facturación, con la tasa de impuesto que aplique a ese cargo |
| El cliente retuvo impuesto a la renta (TDS) al pagar | Regístralo en la ventana de pago de la factura como **TDS deducted**. No es dinero recibido; es impuesto por el que reclamarás crédito (**Reports → TDS Receivable**) |

## Dónde ves los totales de impuesto

- **Reports → Tax Report:** impuesto cobrado en ventas, por tasa y por categoría de impuesto.
- **Reports → GSTR-1:** ventas para la declaración, business-to-business por factura y tasa, business-to-consumer por tasa y estado, filas nil-rated, exempt y non-GST, y filas de notas de crédito y débito.
- **Reports → GSTR-3B Preview:** suministros salientes (incluyendo zero-rated) y compras con reverse-charge del mes. Es una vista previa para comparar con lo que muestra el portal; la presentación se hace en el portal del gobierno.
- **Reports → HSN Summary:** ventas por código HSN (las líneas de cotización llevan el código HSN hasta la factura).
- **Reports → Purchase GST Register** y **Purchase HSN Summary:** lo mismo para compras (facturas, órdenes de compra recibidas y notas de débito).
- **Reports → GST Net Payable & Input Credit:** el impuesto que cobraste, el crédito fiscal de entrada de tus compras, y lo que queda por pagar o llevar adelante, por CGST, SGST e IGST.
- **Reports → GSTR-9 Annual Data:** un papel de trabajo de las cifras del año para tu declaración anual.
- **Reports → TDS Deducted:** impuesto que retuviste a proveedores, por sección, y cuánto falta por depositar.
- **Reports → TDS Receivable:** impuesto que retuvieron tus clientes.
- En cada factura impresa: las líneas de impuesto para la presentación elegida y, si aplica, la nota "Prices include tax".

## Impuesto en compras y crédito fiscal de entrada

Las facturas de proveedor, órdenes de compra y notas de débito calculan el impuesto de la misma manera. El costo del stock nunca incluye el impuesto de compra: para una factura u orden de compra con precio que incluye impuesto, Sarang usa el costo antes de impuesto para el valor de inventario y el costo promedio.

Para un negocio con GST en el régimen regular, el impuesto en cada factura de proveedor, orden de compra recibida y nota de débito se registra como **input tax credit** en su propia cuenta. **GST Net Payable & Input Credit** muestra lo que cobraste, el crédito que tienes, y la diferencia. El crédito solo se registra para documentos hechos desde ahora en adelante; las compras anteriores no se cuentan, y el informe lo indica. Tampoco decide el orden en que el crédito se compensa contra cada rubro: eso lo decide tu contador.

**Accounting → GST Payments** (India) registra el pago que haces al gobierno: reduce lo que debes en impuesto y el crédito que usaste, y reduce tu banco o efectivo. Verifica los montos con tu contador antes de pagar.

**Accounting → GST Return Files** (India) prepara **GSTR-1** y **GSTR-3B** como archivos JSON que puedes subir tú mismo en el portal del gobierno o abrir en su herramienta offline: elige el mes, prepara el archivo y guárdalo. En la propia página de una factura, las tarjetas **e-invoice** y **e-way bill** preparan el archivo de solicitud para esa factura, y después de subirlo a mano escribes el IRN que te devuelve para que se imprima con su código QR (**Reports → E-invoice IRN Register** los lista). Todos estos son borradores hechos de tus registros. El formato de estos archivos sigue el formato offline del portal según lo entendemos, así que abre cada uno en la herramienta propia del gobierno y corrige lo que señale antes de confiar en él. Nada se envía al gobierno desde Sarang.

**Cotejar tus compras con el portal:** descarga tu GSTR-2B (o 2A) en JSON desde el portal y elígelo en **GST Return Files**. Sarang lo coteja con tus facturas de proveedor por GSTIN del proveedor, número de factura y fecha, y lista qué coincide, qué es diferente, qué falta en tus registros y qué falta en el portal. Escribe el propio número de factura y fecha de cada proveedor en la factura para que el cotejo funcione.

## Errores comunes

| Error | Resultado | Solución |
|---|---|---|
| Ingresar un precio con impuesto incluido en un documento antes de impuesto | El impuesto se añade sobre un precio que ya lo tenía | Activa **Prices include tax** para ese documento, o ingresa el precio antes de impuesto |
| Olvidar fijar la tasa de impuesto en un producto nuevo | Los documentos no muestran impuesto | Fíjala en el producto |
| Usar la tasa equivocada para un artículo | Impuesto incorrecto en cada venta | Confirma el HSN y la tasa con tu CA y corrige el producto |
| Elegir IGST para una venta dentro del mismo estado | Una línea IGST en lugar de CGST y SGST | Cambia **Tax shown as** en el documento antes de guardar, o cancela y vuelve a emitir, o usa una Nota de crédito |
| Omitir el impuesto en una nota de crédito de una factura con impuesto | El impuesto que cobraste queda en los libros | Vuelve a activar **Add tax to this note** |
