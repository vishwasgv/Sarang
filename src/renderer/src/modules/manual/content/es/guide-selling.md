# Guía: vender, de la cotización al dinero

Todo lo que hace cuando un cliente compra, en el orden en que ocurre. Salte los pasos que no necesite: una tienda que factura en el mostrador solo necesita el paso 4.

```
Cotización  ->  Orden de Venta  ->  Factura (Facturación)  ->  Pago  ->  (Devolución / Nota de Crédito)
 opcional        opcional            siempre                  al pagar    solo si algo vuelve
```

## 1. Añadir el cliente (una vez)

**Sales → Clientes → Add Customer.** Escriba nombre y teléfono. Añada dirección, correo y número de impuesto (GSTIN) si factura a empresas. Elija **Individual** o **Business**; una empresa también pide número de registro de la sociedad y una persona de contacto.

- **Busque antes de añadir.** Escriba primero el número de teléfono. Sarang impide un segundo cliente con el mismo teléfono, así una persona nunca se convierte en dos registros. También comprueba el GSTIN y el correo, y el botón **Find duplicates** de la pantalla Clientes lista los registros que parecen la misma persona para que pueda **fusionarlos**. Una fusión mueve todas las facturas y pagos al registro que conserva y no se puede deshacer.
- **Límite de crédito**: fíjelo para los clientes que compran a crédito. Sarang no dejará que una venta les haga superar el límite.
- **Condiciones de pago**: escriba los días que este cliente suele tardar en pagar (por ejemplo 30). Cada factura nueva para él recibe entonces su fecha de vencimiento automáticamente.
- **Otras direcciones**: en la página del cliente, **Other addresses** guarda una dirección de envío, almacén o sucursal junto a la principal.
- **Exento de impuestos**: márquelo para un cliente al que no se debe cobrar impuesto. Puede registrar el número del certificado de exención y la fecha hasta la que es válido. Pasada esa fecha, Sarang vuelve a cobrar impuesto y el formulario del cliente le avisa de que el certificado ha caducado.
- **No enviar mensajes a este cliente**: márquelo si pidió no recibir recordatorios ni ofertas. Los recordatorios pendientes para él se eliminan y no se ofrecen nuevos para enviar.
- **Estado de cuenta**: el botón **Statement** de la página del cliente abre su cuenta (cada factura, pago y nota de crédito con saldo acumulado) listo para imprimir o enviar.
- **Archive, no elimine**, a un cliente al que ya no atiende. Su historial se conserva.

También puede añadir un cliente al momento mientras factura (**+ Add Customer**, solo nombre y teléfono).

## 2. Dar un precio: Cotización (opcional)

**Sales → Cotizaciones → New Quotation.** Elija el cliente (o escriba un nombre), añada artículos y fije **Valid until** (el último día en que el precio se mantiene). Guárdela como Borrador, imprímala o compártala por WhatsApp y márquela como **Sent**.

- Cuando el cliente acepte, ábrala y pulse **Convert to Invoice** (o **Convert to Sales Order** para un cliente que se ha comprometido pero al que aún no se factura). La cotización pasa a **Accepted**.
- **Las cotizaciones caducan solas.** El día siguiente a *Valid until*, una cotización en Borrador o Enviada pasa a **Expired**. Una cotización caducada no se puede convertir. Si decide respetarla, cambie su estado de nuevo a **Sent**; Sarang borra la caducidad anterior para que no vuelva a vencer en la misma hora. Use el filtro **Expired** para ver quién no respondió.
- **Factura proforma**: elija *Proforma invoice* como tipo de documento cuando necesite pedir el pago por adelantado. Se numera PF-, se imprime como "PROFORMA INVOICE, Not a tax invoice" y se convierte en una factura real igual que una cotización.
- El impuesto de cada línea viene del producto; puede cambiarlo en la línea.

## 3. Confirmar un pedido: Orden de Venta (opcional)

**Sales → Órdenes de Venta → New Sales Order.** Úsela cuando el cliente ha dicho que sí pero aún no puede facturar (mercancía no lista, a la espera de un depósito).

1. **New Sales Order**: cliente, fecha prevista, artículos. Cada artículo toma el precio y el tipo de impuesto del producto.
2. **Confirm Order** para bloquearla. (Si hay una regla de aprobación, primero espera la aprobación.)
3. **Create Invoice** cuando esté listo. Puede facturar una parte ahora y el resto después; la orden lleva la cuenta de cuánto está facturado (*Partially Invoiced* y luego *Invoiced*).

Una Orden de Venta abierta **promete** stock: **Inventario** y el informe Stock Summary muestran cuánto está prometido en pedidos, y Sarang le avisa cuando confirma un pedido por más de lo que tiene libre. Es solo un aviso: nada le impide vender stock prometido, así que compruebe antes de prometer las últimas unidades. La orden no toca sus libros hasta que factura.

## 4. Vender: la pantalla de Facturación (el trabajo principal)

**Sales → Facturación.** Esta es la pantalla de venta.

1. **Añada artículos.** Busque por nombre, SKU o código de barras, o toque un mosaico de producto. Los productos que más vende aparecen como mosaicos sobre el cuadro de búsqueda. Use **Browse Products** para moverse por categorías sin escribir.
2. **Fije cantidad y descuento** en cada línea. El botón pequeño junto al descuento cambia entre **porcentaje**, **importe** y **precio negociado/final** (escriba el precio acordado y Sarang calcula el descuento).
3. **Elija el cliente** (o déjelo en blanco para un cliente de paso).
4. **Elija cómo paga**: Efectivo, UPI, Tarjeta, Monedero, **Crédito (pagar después)** (necesita un cliente; la factura queda sin pagar y suma a lo que debe) o **Dividido** (por ejemplo parte en efectivo, parte en UPI).
5. **Impuesto.** El impuesto viene de cada producto. Si usa GST, **Tax shown as** elige CGST + SGST, IGST o una sola línea de GST; Sarang elige según los dos estados y usted puede cambiarlo. El importe del impuesto es el mismo se muestre como se muestre. Vea *Guide: Tax and GST*.
6. **Extras en la factura.**
   - **Add Charge** añade una línea de propina, envío o entrega, embalaje, manipulación, instalación u otro cargo. Indique el importe y, para todo salvo la propina, el tipo de impuesto que le corresponde.
   - **Give free** (bajo el nombre de una línea) convierte toda la línea en una muestra o regalo: el stock sale igual, el precio y el impuesto pasan a cero y la factura lo muestra como gratis.
   - **Export sale?** aparece cuando el cliente está en otro país. Márquelo para no cobrar impuesto en esta venta (una exportación con tipo cero). Sarang nunca lo hace por sí solo, y las notas de la factura dicen "Export supply, zero-rated". Compruebe las normas de exportación de su país y conserve su prueba de exportación.
7. Revise los totales. El total se redondea según la regla elegida en **Configuración → Currency & Locale → Invoice rounding** (ninguno, al 0,05, 0,10, 0,50 o 1 más cercano). El redondeo aparece como su propia línea.
8. **Confirm Sale** (o pulse **F10** o **Ctrl + Enter**). Se abre la factura.

**¿Atiende a dos clientes a la vez?** **Hold Sale** aparca el carrito; **Resume Sale** lo recupera.

**¿Precio o artículo equivocado?** Corríjalo antes de confirmar. Después de confirmar, una factura no se puede editar; anúlela (con un motivo) y haga una nueva, o use una Nota de Crédito para una corrección parcial.

**¿Envía mercancía a un cliente en India?** Para una venta con GST de 50.000 o más, Sarang le recuerda la e-way bill y le deja guardar su número en la factura. Otros datos del albarán (transportista, número LR) están en **Create Delivery Note**.

## 5. Dar al cliente su copia

En la pantalla de la factura:

- **Print** (A4) o **Print Receipt** (rollo térmico).
- **Share on WhatsApp** o **Email**: Sarang abre WhatsApp o su correo con el mensaje listo. Adjunte el PDF guardado y pulse Enviar usted mismo. No se envía nada sin usted.
- **Create Delivery Note** si envía mercancía.

## 6. Cobrar el dinero

- **Pagado en el mostrador**: eligió el método en el paso 4; la factura ya está Pagada.
- **Pagado después**: abra la factura (**Facturación → lista de facturas**) y pulse **Record Payment**. Escriba el importe (parcial o total), el método y una referencia. Un pago parcial deja la factura en **Partial**.
- **¿El cliente pagó menos porque retuvo impuesto sobre la renta (TDS)?** En la ventana de pago elija **TDS deducted** y escriba el impuesto que retuvo. Salda esa parte de la factura sin que llegue dinero, y Sarang lo registra como impuesto del que recibirá crédito. El informe **TDS Receivable** lo lista para que lo cruce con sus certificados.
- **Pago registrado por error**: **Reverse** con un motivo. Sigue en pantalla, tachado, como registro.
- **Ver todos los pagos recibidos**: **Payment History** (desde las pantallas de Facturación), con búsqueda por factura, cliente o referencia.
- **¿Quién me debe?** **Clientes** muestra cada saldo; **Informes → Outstanding** clasifica las deudas por antigüedad (al corriente, 1 a 30 días, 31 a 60, etc.). Ask Sarang también responde "¿Quién me debe dinero?".

## 7. Cuando vuelve mercancía o el precio era erróneo

- **Devolución total o parcial de una venta**: **Sales → Sales Returns** (actívelo en **Configuración → Additional Business Features** si no lo ve). El stock vuelve al estante y se ajusta el saldo del cliente o el reembolso.
- **Dinero a devolver sin devolución de stock** (cobro de más, cortesía): **Sales → Notas de Crédito → New**, vinculada al cliente y a la factura. Reduce lo que el cliente le debe. Cada nota tiene **Add tax to this note**: déjelo activado para devolver también el impuesto, o desactívelo para un importe simple.
- **Factura hecha por error**: ábrala y **Cancel Invoice** (motivo obligatorio).

## 8. Clientes habituales y morosos

- **Perfiles Recurrentes** (grupo Accounting) crean la misma factura según un calendario, para alquileres, suscripciones y anticipos.
- **Listas de Precios** dan a un grupo de clientes sus propios precios; **Esquemas de Precios** ejecutan ofertas (compre 2 y llévese 1 gratis, 10 % de descuento en una categoría). Sarang muestra la oferta en el carrito; usted decide si aplicarla.
- **Interés por pagos tardíos**: actívelo en **Configuración → Business Features → Interest on overdue balances** y fije una tasa anual (simple o compuesta mensual). Nada se cobra solo: en la página de un cliente ve el interés que ha generado cada factura vencida y pulsa el botón para cobrarlo.

## 9. Resumen de ventas e informes

**Sales → Sales Overview** muestra ventas y facturas de hoy, lo que los clientes le deben y cuánto está vencido, cotizaciones abiertas y atajos a cada pantalla de ventas. **Informes** tiene ventas por cliente, artículo, categoría y vendedor (elija el vendedor en el mostrador), beneficio por artículo y cliente, un registro de ventas, cuentas por cobrar y más, cada uno con un gráfico.

## Preguntas frecuentes

**¿Puedo vender sin stock?** Sarang bloquea la venta de un producto con stock cuando no hay suficiente en Inventario ("Insufficient stock"). Reciba primero la compra, o ajuste el stock con un motivo. Si a veces debe vender antes de registrar la entrada de la mercancía, consulte a su contador y active el stock negativo en **Configuración → Business Features → Stock rules**.

**¿Dónde veo las ventas de hoy?** El **Panel**, o **Informes → Sales**.

**¿Por qué el impuesto aparece encima del precio?** Por defecto Sarang trata cada precio como *antes de impuestos* y suma el impuesto encima. Si sus precios ya incluyen impuesto, active **Prices include tax** (Configuración, o el interruptor en el documento). Vea *Guide: Tax and GST*.

**¿Por qué no hay impuesto en esta factura?** El artículo no tiene tipo de impuesto, el cliente está marcado como exento, la venta se marcó como exportación, o su negocio está en el régimen de Composición.
