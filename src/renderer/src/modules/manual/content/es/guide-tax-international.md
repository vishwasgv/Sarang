# Guía: Impuestos fuera de India (IVA, impuesto sobre ventas y otros)

Sarang funciona para negocios en cualquier país. Esta guía explica cómo funciona el impuesto cuando tu negocio no está en el GST de India, y cómo configurarlo. Las reglas fiscales difieren según el país y cambian, así que confirma tus tasas, el formato de tu número fiscal y tus declaraciones con tu contador local o autoridad fiscal. Sarang guarda las tasas que usas; no las decide por ti.

## Las reglas del país aplican solo a tu país

Sarang carga tasas de impuesto y etiquetas **solo para el país que elijas como país de tu negocio**. Si tu negocio está en Alemania, ves las tasas y términos de Alemania y nada de ningún otro país. India funciona exactamente como siempre a menos que elijas otro país. Eliges el país en la configuración inicial, o después en **Settings → Business Profile**.

**Idioma.** Las pantallas de Sarang están disponibles en 13 idiomas (inglés, hindi, maratí, guyaratí, canarés, tamil, telugu, malabar, español, francés, portugués, árabe e indonesio). Para un país cuyo idioma no es uno de estos, los nombres y notas fiscales del país se muestran en **inglés**, sea cual sea el idioma del resto de la pantalla.

## Paso 1: elige tu país

En la configuración, elige tu país de la lista (aún puedes escribir uno que no esté listado). Sarang reconoce cerca de 50 países y, para cada uno, sugiere el modelo de impuesto, la moneda, la etiqueta del número fiscal, las tasas estándar, si los precios en estante suelen incluir impuesto, y el redondeo en efectivo habitual allí. Confirmas cada sugerencia; nada se aplica en silencio.

Países con tasas incorporadas (al 25 de septiembre de 2026): India, el Reino Unido, Irlanda, Alemania, Francia, Italia, España, los Países Bajos, Portugal, Bélgica, Austria, Polonia, Suecia, Dinamarca, Suiza, los Emiratos Árabes Unidos, Arabia Saudita, Omán, Baréin, Catar, Kuwait, Egipto, Turquía, Israel, Australia, Nueva Zelanda, Singapur, Malasia, Tailandia, Indonesia, Filipinas, Vietnam, Japón, Corea del Sur, China, Hong Kong, Pakistán, Bangladés, Sri Lanka, Nepal, Sudáfrica, Kenia, Nigeria, Ghana, Canadá, los Estados Unidos, México, Argentina, Chile y Colombia. Catar, Kuwait y Hong Kong no tienen IVA ni impuesto sobre ventas, así que comienzan sin impuesto. Los Estados Unidos no tienen impuesto nacional sobre ventas y sus tasas estatales varían, así que agregas las tuyas. Brasil tiene varios impuestos sobre una misma venta y no está incluido: agrega tus tasas a mano. **Las tasas cambian**, y la lista muestra la fecha en que se revisó por última vez; confirma siempre con tu autoridad fiscal.

Si tu país no está en la lista, la lista de tasas de impuesto comienza con una única fila "No tax" y una nota pidiéndote agregar tus tasas a mano.

## Paso 2: revisa tu modelo de impuesto y tasas

| Modelo de impuesto | Se usa para | Qué se imprime |
|---|---|---|
| **GST** | India | CGST y SGST, o IGST, o una línea de GST, con tu GSTIN |
| **VAT** | Países con un impuesto al valor agregado o un impuesto estilo GST (el Reino Unido, la UE, el Golfo, Australia, Nueva Zelanda, Singapur, Canadá y otros). La línea usa el propio nombre de tu país para el impuesto, por ejemplo GST en Australia | Una línea con el nombre de tu impuesto |
| **Sales Tax** | Los Estados Unidos y otros países con impuesto sobre ventas | Una línea llamada **Sales Tax** |
| **Custom** | Cualquier otro impuesto con su propio nombre | Una línea llamada **Tax** |
| **None** | No se cobra impuesto | Sin línea de impuesto |

Abre **Settings → Tax Configuration**. Lista las tasas que cobras. Si tu país de negocio tiene tasas incorporadas, un botón **Load tax rates for {your country}** agrega las que falten (nunca elimina ni cambia las que ya tienes, ni cambia documentos pasados). La pantalla muestra la fecha en que las tasas se revisaron por última vez y cualquier nota, por ejemplo donde un país tiene tasas provinciales o estatales adicionales. Marca tu tasa habitual como predeterminada, y agrega la que falte. Luego fija la tasa correcta en cada producto (Products → Tax Rate %) o elígela de tus tasas guardadas. Sarang te advierte suavemente si una tasa que escribes no es una de tus tasas guardadas.

Elige la **Tax category** de cada producto: standard, reduced, zero-rated, exempt, nil-rated u out of scope. Un artículo **zero-rated** (cobrado al 0 por ciento pero aún declarable) es diferente de uno **exempt**. Un cliente exento puede marcarse como exento de impuesto en su página, con el número de certificado de exención o reventa y la fecha hasta la que es válido; sus facturas no llevan impuesto mientras el certificado sea válido, y el impuesto se cobra de nuevo después de esa fecha (el formulario del cliente te advierte).

### Dividir una tasa en partes

Donde una venta lleva dos impuestos (el GST federal de Canadá más el PST provincial, o el impuesto de venta estatal más el del condado en EE. UU.), ingresa la **tasa combinada** como una sola tasa, luego en el formulario de la tasa usa **Add part** para nombrar sus partes, por ejemplo GST 5 y PST 7 para una tasa del 12 por ciento. Las partes deben sumar la tasa. El monto cobrado no cambia; las facturas, cotizaciones, facturas de compra y órdenes de compra muestran entonces cada parte en su propia línea, y **Reports → Tax by Part** suma el impuesto en ventas y en compras para cada parte, para que cada una pueda declararse ante su propia autoridad. Un impuesto cobrado sobre otro impuesto (impuesto sobre impuesto) no se modela: ingresa en su lugar la tasa combinada efectiva.

## Paso 3: precios con impuesto o sin él

Las tiendas de muchos países muestran precios de estante que ya incluyen impuesto. En la configuración, Sarang sugiere si los precios en tu país suelen incluir impuesto, y tú lo confirmas. Puedes cambiarlo en cualquier momento en **Settings → Currency & Locale → Prices include tax**, y en cada documento hay un interruptor **Prices include tax** con la columna de precio etiquetada **(incl. tax)** o **(excl. tax)**.

Antes de impuesto, el impuesto se añade encima:

```
valor imponible = cantidad x precio - descuento
impuesto        = valor imponible x tasa
total           = valor imponible + impuesto
```

Ejemplo: 3 artículos a 10.00, descuento 10 por ciento, IVA 20 por ciento. Línea 30.00, imponible 27.00, IVA 5.40, total 32.40.

Con impuesto incluido, el impuesto se extrae del precio que escribiste: un precio de 12.00 incluyendo 20 por ciento de IVA da imponible 10.00, IVA 2.00, total 12.00. El total es siempre el precio que ve el cliente.

Los montos mantienen los decimales exactos que usa tu moneda (dos para dólares, libras, euros y dirhams; tres para dinar; ninguno para yen).

## Paso 4: redondeo en efectivo

**Settings → Currency & Locale → Invoice rounding** ofrece None, nearest 0.05, 0.10, 0.50 o 1. Muchos países redondean los totales en efectivo (por ejemplo a 0.05 en Suiza, Australia y Nueva Zelanda). En la configuración, Sarang sugiere la regla habitual de tu país y tú la confirmas. El redondeo se muestra como su propia línea en la factura.

## Paso 5: números fiscales

Ingresa tu **número fiscal** en **Settings → Business Profile**; se imprime en las facturas. El campo toma el nombre que usa tu país (VAT number, TRN, ABN, EIN, GST number, etc.). Clientes y proveedores tienen el mismo campo. Donde Sarang está seguro del formato del número de un país, muestra una pista suave si el número parece incorrecto; nunca te bloquea de guardar. Sarang verifica el formato estricto solo del GSTIN, PAN e IFSC indios.

## Vender a otros países

- **Moneda extranjera:** en un documento de venta marca la opción de moneda extranjera e ingresa el código de moneda. Si mantienes una tabla de tasas en **Settings → Business Features → Exchange rates** (escríbelas o importa un CSV con las columnas moneda, tasa, fecha), la tasa más reciente se completa por ti; siempre puedes cambiarla. Sarang muestra el monto convertido y mantiene tus libros en tu propia moneda. Cuando el cliente paga, **Settle in {currency}** registra cualquier ganancia o pérdida cambiaria.
- **Impuesto en exportaciones:** muchos países dejan las exportaciones en zero-rate. Cuando el país del cliente es distinto al tuyo, la pantalla de Facturación muestra **Export sale?**: márcala y la venta queda zero-rated, con la nota "Export supply, zero-rated" en la factura. Sarang nunca hace esto por sí solo. Pregunta a tu contador qué ventas califican y guarda tu evidencia de exportación.
- **Proveedores en el extranjero:** registra una **Supplier Bill** en moneda extranjera de la misma manera. Si debes contabilizar tú mismo el impuesto en una importación o un servicio del extranjero (reverse charge), marca **Reverse Charge** en la factura.

## Notas de crédito y débito

Cada una tiene **Add tax to this note**: omítelo y el total de la nota es solo el monto; agrégalo y el impuesto se calcula en la nota como en cualquier documento. Ver *Guía: Impuestos y GST, cómo los calcula Sarang* para los detalles.

## Informes que puedes usar para tu declaración

- **Reports → VAT / Sales Tax Return:** un papel de trabajo organizado según las casillas de la declaración de tu país para el Reino Unido, Australia, Nueva Zelanda, Canadá, Singapur, los Emiratos Árabes Unidos, Arabia Saudita y Sudáfrica, y un resumen genérico (ventas y compras por tratamiento fiscal) para cualquier otro país. Las casillas que Sarang no puede completar con tus registros quedan en cero y etiquetadas en inglés. Verifica cada casilla contra el formulario de tu autoridad fiscal antes de presentar.
- **Reports → Tax Report:** impuesto cobrado en ventas, por tasa y por categoría de impuesto, para cualquier rango de fechas. Funciona para cualquier modelo de impuesto.
- **Reports → Tax by Part:** impuesto en ventas y compras para cada parte nombrada de una tasa.
- **Reports → Purchase Register:** lo que compraste, con el impuesto de cada factura, para que tu contador pueda calcular el impuesto que puedes reclamar.
- **Reports → TDS Deducted** y **TDS Receivable:** impuesto que retuviste a proveedores, e impuesto que tus clientes te retuvieron. Las pantallas lo llaman TDS; úsalo también para la retención de impuestos en tu país, y confirma las reglas con tu asesor fiscal.
- **Reports → Profit and Loss**, **Balance Sheet**, **Trial Balance** y **Cash Book** para el período.

## Límites que conviene conocer hoy

- Una tasa de impuesto por línea. Dos impuestos sobre una venta se manejan dividiendo la tasa combinada en partes (arriba); el monto cobrado siempre es la tasa combinada.
- Sarang no elige una tasa según el estado, condado o ciudad del cliente. Agrega las tasas combinadas que necesites (por ejemplo una por cada estado en el que vendes) y elige la correcta en el producto o la línea.
- Los elementos exclusivos de India (GST return files, e-way bill, HSN, PF y ESI) quedan ocultos para otros países.
- Los envíos de facturación electrónica gubernamental y la presentación en línea no están incluidos; Sarang funciona sin conexión y nunca envía nada a una autoridad fiscal.
