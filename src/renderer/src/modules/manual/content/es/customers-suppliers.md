# Clientes y Proveedores

## Agregar clientes y proveedores

Abra **Clientes** o **Proveedores** desde la barra lateral para ver la lista completa. Haga clic en **Add Customer** / **Add Supplier** para crear uno. Un registro de cliente guarda nombre, teléfono, correo electrónico, dirección (ciudad/estado/país), número fiscal, límite de crédito y notas; un registro de proveedor guarda los detalles equivalentes del lado empresarial (nombre, teléfono, correo electrónico, dirección, número fiscal, notas).

Cualquiera de los dos puede ser **archivado** en lugar de eliminado, lo que lo oculta de las listas del día a día (facturación, creación de órdenes de compra, etc.) sin perder su historial de transacciones.

## Libro y saldo pendiente

Al hacer clic en un cliente o proveedor se abre su pantalla de detalle, que muestra la información de contacto junto a su cuenta en curso:

- La pantalla de detalle de un **cliente** muestra su límite de crédito y su **saldo pendiente** — cuánto le debe actualmente a usted — más un libro de transacciones de cada débito (una factura de venta a crédito) y crédito (un pago o nota de crédito) que afecta ese saldo, cada uno con un total acumulado.
- La pantalla de detalle de un **proveedor** muestra el **saldo por pagar** — cuánto le debe usted actualmente a él — con el mismo tipo de libro (una compra aumenta lo que usted debe; un pago o nota de débito lo reduce). Si le debe dinero a un proveedor, un botón **Record Payment** le permite registrar un pago contra él directamente (Efectivo, Transferencia Bancaria, Cheque, UPI, Tarjeta u Otro), con un número de referencia y notas opcionales.

Ambos libros muestran las últimas 100 entradas. El saldo mostrado siempre se calcula a partir del historial completo de transacciones, no de un número acumulado en caché, por lo que nunca puede desincronizarse de lo que realmente ocurrió.

## El patrón de búsqueda rápida por teléfono

Donde sea que Sarang necesite que usted vincule un cliente a algo — una nueva factura, una cotización, una cita, un registro de entrada de hotel, etc. — usa el mismo cuadro de búsqueda **CustomerPicker**: comience a escribir un nombre o número de teléfono, y cualquier coincidencia existente aparece en un menú desplegable en cuestión de instantes. Si el cliente aún no existe, **+ Add new customer** despliega un formulario en línea para solo un nombre y teléfono, y selecciona inmediatamente al cliente recién creado sin salir de la pantalla en la que estaba.

Esto es deliberado: buscar por número de teléfono antes de crear un nuevo registro es lo que evita que la misma persona termine como múltiples entradas de Cliente duplicadas en distintas partes de la aplicación. Busque siempre primero — si un cliente fue creado desde cualquier otra pantalla de Sarang, su número de teléfono lo encontrará de nuevo aquí.

## Historial de compras del proveedor

La participación de un proveedor en sus compras aparece en varios lugares conectados en lugar de una sola pantalla: **Purchase Orders** filtradas o buscadas por nombre de proveedor, el propio libro del proveedor (que refleja cada orden de compra recibida y cada pago realizado contra él), y cualquier **Debit Notes** generada contra una orden de compra con ese proveedor. Juntos, estos le dan una imagen completa de lo que ha comprado a un proveedor y de lo que actualmente le debe.
