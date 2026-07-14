# Facturación y Documentos

## Crear una factura

Abra **Facturación** desde la barra lateral (`/billing`) para llegar a la pantalla de punto de venta. Aquí es donde comienza cada factura:

1. **Busque productos** en el cuadro de la izquierda — por nombre, SKU o código de barras. Seleccionar un resultado (o escanear un código de barras) lo agrega al carrito. Si el producto tiene variantes (talla/color) o números de serie rastreados (IMEI), aparece un selector para que elija exactamente cuál antes de agregarlo.
2. **Ajuste la cantidad y el descuento** en cada línea del carrito. La cantidad avanza en unidades enteras, o de 0.1 en 0.1 para un artículo con precio por peso. El descuento puede ingresarse como un importe en moneda o como un porcentaje — el pequeño botón de alternancia junto al campo de descuento cambia entre ambos.
3. **Elija el cliente**, en el lado derecho. Escriba un nombre o número de teléfono para buscar clientes existentes; si es nuevo, haga clic en **+ Add Customer** para agregar rápidamente solo un nombre y teléfono sin salir de la factura. Dejar el campo de cliente vacío factura a un cliente ocasional.
4. **Elija un método de pago**: Efectivo, UPI, Tarjeta, Billetera, Crédito (Pagar Después) o Dividido. **Crédito** requiere que se seleccione un cliente — la factura se crea SIN PAGAR y el importe se agrega al libro de ese cliente. **Dividido** le permite ingresar importes separados de Efectivo y UPI que deben sumar el total de la factura.
5. **Aplique un descuento global** (además de cualquier descuento por línea) si es necesario, usando el cuadro de descuento en el panel de resumen.
6. Si su modelo de impuestos es GST, marque **Inter-State Sale (IGST)** cuando la venta cruce límites estatales — esto cambia las líneas de impuesto impresas de CGST+SGST a una única línea de IGST.
7. Haga clic en **Confirm Sale** (o pulse **F10** / **Ctrl+Enter**) para crear la factura. Se le lleva directamente a la pantalla de detalle de la nueva factura.

El carrito muestra un subtotal en curso, descuento, impuesto, ajuste de redondeo y total mientras lo va armando. **Clear Cart** en la parte inferior reinicia todo sin guardar.

## Historial y detalle de facturas

**Invoice List** (`/billing`, mediante la vista de lista de facturas) muestra cada factura con su cliente, cantidad de artículos, total, saldo pendiente y estado de pago (SIN PAGAR / PARCIAL / PAGADA / CANCELADA). Busque por número de factura o cliente, filtre por rango de fechas o por estado Activa/Cancelada.

Al abrir una factura se muestran todas sus líneas de artículos, el desglose de impuestos y el historial de pagos. Desde aquí puede:

- **Registrar Pago** — ingrese un importe (total o parcial), elija un método (Efectivo, UPI, Tarjeta o Billetera — Crédito no se ofrece aquí ya que registrar un pago significa que se recibió dinero real), y un número de referencia y observaciones opcionales. Registrar un pago actualiza el saldo y el estado de pago de inmediato; registrar menos que el saldo total deja la factura en estado PARCIAL.
- **Revertir un pago** — si un pago se registró por error, reviértalo con un motivo. El pago revertido permanece visible (tachado) para el rastro de auditoría.
- **Print** o **Print Receipt** — previsualice el diseño de factura A4 o de recibo térmico antes de enviarlo a la impresora.
- **Cancel Invoice** — requiere un motivo y no se puede deshacer.
- **Send to Kitchen** — solo aparece para negocios de tipo Restaurante con KOT activado, y solo antes de que ya exista un KOT para esa factura.

**Payment History** es una pantalla separada que lista cada pago registrado alguna vez, en todas las facturas — se puede buscar por factura, cliente o número de referencia, y filtrar por método de pago o rango de fechas. Revertir un pago también se puede hacer desde aquí.

## Cotizaciones (Quotations)

**Quotations** (`/billing/quotations`) son presupuestos de precio no vinculantes que puede entregar a un cliente antes de que se comprometa. Cree uno con **New Quotation**: elija o escriba un nombre de cliente, agregue líneas de artículos (buscados de la misma manera que en Facturación), una fecha de validez opcional y notas.

Una cotización comienza como **Borrador** y puede ser **Enviada**, **Aceptada** o **Vencida**. Una vez que el cliente la acepta, haga clic en **Convert to Invoice** — esto crea una factura real a partir de los artículos de la cotización y marca la cotización como Aceptada. Una cotización que ya fue convertida muestra un enlace a la factura resultante en lugar del botón de conversión. Las cotizaciones se pueden imprimir en tamaño A4 o ancho de recibo, y se pueden eliminar mientras no hayan sido convertidas.

## Notas de Crédito y Notas de Débito (Credit Notes / Debit Notes)

**Credit Notes** (`/billing/credit-notes`) registran dinero que se debe *devolver a* un cliente — típicamente por una devolución, un cobro excesivo o un ajuste de buena voluntad. Cree una con un motivo e importe, opcionalmente vinculada a un cliente y/o a la factura original. Vincularla a un cliente acredita automáticamente su libro, reduciendo lo que le debe a usted.

**Debit Notes** (`/billing/debit-notes`) son el equivalente del lado del proveedor — dinero que un proveedor le debe a usted, por ejemplo una devolución de stock comprado o una corrección de facturación. Vincular una nota de débito a un proveedor debita su libro, reduciendo lo que usted le debe. Tanto las notas de crédito como las de débito pueden referenciar opcionalmente la factura u orden de compra a la que se relacionan, se pueden editar o eliminar, y se imprimen en tamaño A4 o ancho de recibo.

## Notas sobre impuestos y redondeo

Cada total de factura se redondea a la unidad de moneda entera más cercana, con la diferencia de redondeo mostrada como su propia línea para que las cuentas siempre cuadren de forma visible. Bajo el modelo de impuesto GST, el impuesto se imprime como CGST+SGST para una venta dentro del mismo estado, o como una única línea de IGST para una venta entre estados, según la casilla marcada al crear la factura.
