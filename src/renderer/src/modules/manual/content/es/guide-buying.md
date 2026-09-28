# Guía: Comprar a proveedores, del pedido al pago

El ciclo completo de compra, con lo que cada paso hace a tu inventario y a tu dinero. Lee primero la tabla: evita la confusión más común.

```
Orden de compra  ->  Recibir stock / GRN  ->  Factura del proveedor  ->  Pago al proveedor  ->  (Nota de débito)
 lo que pediste       llega la mercancía      lo que debes              lo que pagaste          mercancía devuelta
 sin stock, sin dinero EL STOCK sube          LO ADEUDADO sube          lo adeudado baja
```

| Paso | ¿Cambia tu stock? | ¿Cambia lo que debes? |
|---|---|---|
| Orden de compra | No | No |
| Recibir stock (en la OC) o un GRN vinculado | **Sí** | Sí (al recibir) |
| Factura del proveedor | **No** | **Sí** |
| Pago al proveedor | No | Sí (baja) |
| Nota de débito | Solo si la mercancía se devuelve | Sí (baja) |

**Una Factura del proveedor nunca cambia el stock.** Solo registra el dinero. El stock sube únicamente cuando recibes la mercancía.

## 1. Agrega al proveedor (una vez)

**Compras → Proveedores → Add Supplier.** Escribe nombre, teléfono, dirección, GSTIN y PAN si los tienes, los datos bancarios para pagarle y un **saldo inicial** si ya le debes dinero.

Sarang evita que crees el mismo proveedor dos veces. No guardará un proveedor si ya existe alguno (activo o archivado) con:

- el mismo **número de teléfono**,
- el mismo **GSTIN**,
- el mismo **correo**,
- el mismo **nombre en la misma ciudad** (si dejas la ciudad en blanco, cualquier nombre igual cuenta).

Si la coincidencia es un proveedor archivado, Sarang te pide restaurarlo en lugar de crear otro. GSTIN, PAN e IFSC se validan en su formato (por ejemplo, un GSTIN tiene 15 caracteres como *29ABCDE1234F1Z5*) y se guardan en mayúsculas. Si dos proveedores distintos comparten nombre, agrega la ciudad de cada uno para distinguirlos. **Find duplicates** en la pantalla Proveedores lista los registros que parecen el mismo proveedor y te deja **fusionarlos** (la fusión pasa todas las facturas y pagos al registro que conservas y no se puede deshacer).

También es útil en el proveedor: una **persona de contacto**, una **categoría** y una **valoración** para tu uso, **condiciones de pago** en días (así una factura nueva recibe su fecha de vencimiento automáticamente) y un **límite de crédito** (un recordatorio de cuánto aceptas deber; se muestra, pero no bloquea una factura). Un **saldo inicial** puede ser negativo si pagaste por adelantado al proveedor. Igual que los clientes, un proveedor puede tener **otras direcciones** en su página.

## 2. Asegúrate de que el producto exista

Todo artículo que compres para revender debe ser antes un **Producto** (**Inventario → Productos**), con su **precio de costo** y **tasa de impuesto**. Si es un artículo nuevo, créalo ahora. También puedes crearlo desde la pantalla de mercancía recibida (paso 4). El impuesto de una compra nunca pasa a formar parte del costo de tu stock: el costo del stock es siempre el precio antes de impuestos.

¿Compras algo que no es stock para reventa (alquiler, reparaciones, honorarios profesionales, equipo)? Omite los productos: regístralo como línea de **Servicio** en una Factura del proveedor o como **Gasto**.

## 3. Pedir: Orden de compra (opcional pero recomendada)

**Compras → Órdenes de compra → New PO.** Elige al proveedor (o **+ Add New Supplier**), agrega artículos con cantidad y costo, y una fecha prevista. Al elegir un producto, su precio de costo **y su tasa de impuesto** se completan solos; puedes cambiar cualquiera.

La OC pasa de **Draft → Approved → Received**. Si hay una regla de aprobación, va primero a un aprobador. Puedes imprimir la OC o enviarla al proveedor por WhatsApp o Email. ¿Poco stock? En la pantalla **Inventario**, **Generate Reorder POs** crea órdenes de compra en borrador para todo lo que esté por debajo de su nivel de reorden, usando el proveedor predeterminado de cada producto.

## 4. Llega la mercancía: recíbela

Hay dos formas. Usa la que corresponda a tu negocio.

**A. Receive Stock en la Orden de compra** (la más simple). Abre la OC aprobada y haz clic en **Receive Stock**. El stock sube, se actualiza el costo promedio y tus libros registran la compra.

**B. GRN (Goods Received Note, nota de recepción)** (cuando una entrega llega por partes, o quieres registrar cantidad dañada o rechazada). **Compras → GRN → New GRN**: elige al proveedor, vincula la OC si quieres y escribe cada artículo con las cantidades recibidas y rechazadas y el costo.

**Importante en un GRN: vincula cada línea a un producto.** Cada línea tiene un desplegable de producto.

- Elegido de la lista: la línea suma al stock de ese producto cuando el GRN se **Publica (Posted)**.
- Dejado como **Not in catalog**: la línea es solo un registro en papel. Muestra una pequeña etiqueta *unlinked* y **no** cambia Inventario ni Productos.
- ¿El artículo aún no está en tu lista? Escribe su nombre y haz clic en **+ Create product "…" and link**. Sarang crea el producto con tu precio de costo y vincula la línea. Fija su **precio de venta** real en Productos antes de venderlo.
- Al hacer clic en **Post** en un GRN con líneas sin vincular, Sarang te avisa cuántas no actualizarán el stock. Cancela y vincúlalas, o publica igualmente.
- Un GRN publicado no se puede cambiar. Si una línea se publicó sin vincular por error, **Reverse** el GRN y regístralo otra vez con el producto vinculado.

Un GRN se guarda como Draft, luego Verified y por último **Posted** (el stock cambia solo en Posted).

**¿Una línea se publicó sin vincular y no puedes revertir el GRN?** En el GRN publicado, una línea sin vincular tiene **Link to an item**. Elige el producto y su cantidad se suma al stock. Esto solo vincula la recepción; no cambia la cantidad recibida de la orden de compra ni los datos de lote, así que revísalos tú.

**¿Cuál de las dos debo usar?** Las pantallas de Orden de compra y GRN muestran una breve pista que indica de qué forma estás recibiendo. Usa una sola forma por entrega, nunca ambas: recibir en la OC y luego publicar un GRN de la misma mercancía suma el stock dos veces.

## 5. Registra lo que facturó el proveedor: Factura del proveedor

**Compras → Facturas de proveedores → Record Bill.**

1. Elige al proveedor (o agrega uno).
2. Fija la **fecha de factura** y la **fecha de vencimiento**. El vencimiento alimenta la lista de Vencidas. Si el proveedor tiene condiciones de pago, la fecha de vencimiento se completa sola. Escribe el **número y la fecha de la factura del propio proveedor** tal como aparecen en su factura en papel: Sarang te avisa cuando el mismo número de factura del proveedor se ingresa dos veces, y los negocios con GST lo necesitan para cotejar las compras con el portal del gobierno.
3. Agrega líneas. Una línea es un **Producto** (costo e impuesto se completan desde el producto) o un **Servicio** (texto libre, con una categoría, para lo que no es stock).
4. Ingresa el **descuento** y la **tasa de impuesto** de cada línea para que los totales coincidan con la factura en papel del proveedor. Compara el total con el papel.
5. Marca **Reverse Charge** solo si tu contador te indica que el impuesto de esta compra lo pagas tú y no el proveedor.
6. Opcionalmente agrega **costos de importación (landed costs)** (flete, aranceles, manejo); se reparten entre los artículos y elevan su costo real.
7. **Guardar.** La factura recibe un número (por ejemplo BILL-00012) y el estado **Open**. Lo que le debes a ese proveedor sube. En un negocio con GST, el impuesto de la factura se registra como **crédito fiscal de entrada** (salvo que estés en el régimen de Composición), y una nota de débito lo reduce de nuevo.

**¿Te equivocaste?** Mientras la factura esté **Open** y **sin ningún pago** registrado, ábrela y haz clic en **Edit bill**. Cambia lo necesario y guarda. Sarang reemplaza la factura con el mismo número, revierte los asientos anteriores y registra los corregidos en un solo paso, y guarda la copia anterior como *BILL-00012-R1 (Void)* para que el historial quede completo. Si ya hay un pago registrado, revierte primero el pago. Para cancelar una factura por completo, usa **Void** (motivo obligatorio).

**Estados de la factura:** Open, Partially Paid, Paid, Void. La lista también tiene un filtro **Overdue** y una insignia **OVERDUE** en toda factura abierta o parcialmente pagada cuya fecha de vencimiento haya pasado.

## 6. Paga al proveedor: Pago al proveedor

Abre la factura y haz clic en **Record Payment**: importe (parcial o total), método (Cash, UPI, Card, Bank Transfer, Cheque), referencia. La factura pasa a **Partially Paid** o **Paid** y tu saldo por pagar baja. **Compras → Pagos a proveedores** lista todos los pagos que has hecho y permite revertir uno equivocado. ¿Pagas varias facturas a un mismo proveedor a la vez? Usa allí la opción de pago masivo.

Si retienes **TDS** al pagar a un profesional o contratista, Sarang sugiere un importe para la sección que elijas. Tómalo solo como sugerencia: confirma la sección y la tasa con tu contador, porque las reglas cambiaron en 2026. **Reports → TDS Deducted** lista lo que retuviste, por sección, y cuánto falta por depositar. En el formulario de pago, **Ctrl + Enter** guarda.

## 7. Devolver mercancía o corregir una factura: Nota de débito

**Compras → Notas de débito → New.** Vincúlala al proveedor (y a la OC o la factura). Reduce lo que debes. Marca **Itemize** para listar los artículos devueltos con su impuesto. Una nota de débito es tu devolución de compra: es la gemela, del lado del proveedor, de una Devolución de venta y una Nota de crédito.

## 8. Mira cómo estás

- **Compras → Resumen de compras**: lo que debes, lo que vence en los próximos 7 días, facturas abiertas y una lista de las facturas por pagar esta semana.
- **Proveedores**: la página de cada proveedor muestra el saldo por pagar y cada factura y pago; el botón **Statement** abre su cuenta para imprimir o enviar.
- **Reports → Purchase Register, Purchases by Vendor, Purchases by Item, AP Aging Summary**: lo que compraste y lo que debes, según cuán vencido está.
- **Reports → Payables / Supplier Ledger**: la cuenta completa de un proveedor.
- **Reports → Purchase GST Register, Purchase HSN Summary, GST Net Payable & Input Credit** (negocios con GST): compras con su impuesto, compras por código HSN y el impuesto que puedes reclamar frente al que cobraste. Consulta *Guide: Tax and GST*.
- Ask Sarang: "¿A quién le debo dinero?", "¿Qué facturas de proveedores están vencidas?", "Facturas que vencen esta semana".

## Un ejemplo práctico

Compras 50 bombillas LED a 40 rupias, más 18 por ciento de impuesto, con 30 días de crédito, y pagas en dos partes.

1. **Productos**: crea *LED Bulb 9W*, costo 40, impuesto 18.
2. **Orden de compra**: proveedor *Amba Agencies*, 50 unidades. Aprueba.
3. **Receive Stock**: llegan 50 bombillas; Inventario ahora muestra 50.
4. **Factura del proveedor**: fecha de hoy, vence en 30 días; la línea se completa como 50 x 40 con 18 por ciento de impuesto; total 2,360. Estado Open, debes 2,360.
5. **Pago al proveedor**: 1,000 por UPI (Partially Paid, debes 1,360), luego 1,360 por transferencia bancaria (Paid).
6. Diez bombillas están defectuosas: **Nota de débito** por 10 x 40 más impuesto, y las devuelves.
