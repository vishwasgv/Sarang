# Banca y Conciliación

## Cuentas bancarias y de efectivo

Abra **Bank Accounts** desde la barra lateral y haga clic en **New Account** para agregar una cuenta con nombre — una cuenta bancaria real (con nombre del banco, número de cuenta enmascarado e IFSC) o una caja/registro de efectivo, elegido mediante el campo **Account Type**. Esto reemplaza un único fondo indiferenciado de "efectivo" por tantas cuentas reales y distintas como realmente tenga su negocio — una cuenta corriente principal, una caja chica, la caja de una segunda sucursal — cada una rastreada por separado.

Si la cuenta ya tiene dinero real el día que la agrega, ingréselo como su **Opening Balance**. Sarang registra un asiento de balance único (Débito a la cuenta, Crédito a Owner's Capital) para que el saldo de la cuenta — y sus libros — sean correctos desde el primer día, sin comenzar silenciosamente en cero.

El **Current Balance** de una cuenta bancaria siempre refleja su saldo real y corriente, formado por cada transacción registrada en ella — facturas cobradas en la cuenta, facturas de proveedores pagadas desde ella, cheques compensados a través de ella, etc. — nunca es un número que se edita directamente.

## Importar y conciliar un extracto bancario

Abra una cuenta bancaria y vaya a **Reconciliation**. Haga clic en **Import Statement** para traer las líneas de su extracto bancario — fecha, descripción, monto de débito o crédito — las mismas filas que ya muestra su extracto (PDF o CSV), ingresadas una sola vez, en lugar de cotejarlas a simple vista con cada transacción en Sarang.

Una vez importado, haga clic en **Auto-Match** — Sarang busca una transacción de Sarang (un Payment, un Expense, un Supplier Payment, o una línea de Journal Entry vinculada al banco) con el mismo monto, fechada dentro de unos pocos días de la línea del extracto. Cuando existe exactamente una transacción así, se concilia automáticamente. Cuando podrían coincidir varias, o ninguna, la línea se deja deliberadamente para su revisión — una suposición que podría estar equivocada es peor que un honesto "necesita revisión".

Para lo que Auto-Match no resuelve, abra la línea y concíliela manualmente con la transacción a la que realmente corresponde, o déjela sin conciliar si genuinamente no corresponde todavía a nada en Sarang (una comisión bancaria, un crédito por intereses). Las líneas ya conciliadas siempre se pueden deshacer con **Unreconcile** si se conciliaron con la línea equivocada.

El **Reconciliation Summary** en la parte superior de la pantalla muestra el saldo de su libro junto al movimiento neto propio del extracto, además de cuántas líneas están conciliadas y cuántas siguen pendientes — la misma verificación de "¿mi libro coincide con el banco?" que haría un contador a mano, hecha por usted.

## Adjuntar el archivo del extracto real

El archivo original del extracto — el PDF o CSV que envió su banco — se puede adjuntar directamente a la cuenta mediante el panel **Documents** en la pantalla de Reconciliation, para que el documento fuente permanezca junto a las líneas procesadas todo el tiempo que lo necesite — el mismo comportamiento de adjuntar/abrir/eliminar que ya tiene cualquier otro documento en Sarang.

## Cheques posdatados

Abra **Post-Dated Cheques** desde la barra lateral para llevar un registro de cheques — número de cheque, cuenta bancaria vinculada, fecha de vencimiento, monto y dirección (Received de un cliente, o Issued a un proveedor). Un cheque que registre comienza como **Pending** y todavía no afecta sus libros — tal como funciona un cheque posdatado real: todavía es una promesa, no una transacción.

Cuando llegue la fecha del cheque y realmente se compense en el banco, márquelo como **Cleared** — solo entonces Sarang registra el pago real (Débito o Crédito a Cash, contra el saldo del cliente o proveedor que liquida). Si vuelve rechazado, márquelo como **Bounced**; si se cancela antes de cualquiera de esos resultados, márquelo como **Cancelled**. Ambos son simples cambios de estado sin ningún asiento financiero, ya que ninguno llegó a convertirse en dinero real.
