# Libro Mayor y Asientos de Diario

## Qué se registra automáticamente en el libro mayor

Cada acción real de movimiento de dinero que ya realiza en Sarang — crear una Factura, registrar una Factura de Proveedor, recibir un Pago, pagar a un Proveedor, registrar un Gasto, compensar un Cheque Posdatado, ejecutar la depreciación de Activos Fijos — ahora también registra automáticamente un asiento de diario real y balanceado de partida doble, en segundo plano. No necesita hacer nada diferente día a día; esto es lo que hace que el Trial Balance, el Chart of Accounts y los saldos de las cuentas bancarias realmente coincidan entre sí, en lugar de ser cifras rastreadas por separado que podrían silenciosamente divergir.

Cancelar, anular o revertir cualquiera de esas mismas acciones registra un asiento de reversión real y reflejado, no solo una eliminación — así el libro mayor siempre muestra lo que realmente sucedió, incluidas las correcciones, sin reescribir la historia.

## Chart of Accounts

Abra **Chart of Accounts** desde la barra lateral para ver las cuentas con las que se construyen sus libros — Cash & Bank, Accounts Receivable, Inventory, Fixed Assets, Accounts Payable, Tax Payable, Owner's Capital, Sales Revenue, Cost of Goods Sold, Operating Expenses, y algunas más — ya configuradas para usted desde la primera vez que use cualquier cosa de esta fase. Cada una tiene un tipo (Asset, Liability, Equity, Income o Expense), que determina en qué lado del libro mayor se ubica normalmente.

Haga clic en **New Account** para agregar la suya propia — útil si desea una categoría de gasto o ingreso más específica que las predeterminadas (por ejemplo, dividir "Operating Expenses" en "Rent" y "Utilities" para su propio seguimiento). Sus propias cuentas se comportan exactamente igual que las integradas en cualquier otro lugar del libro mayor.

## Registrar un asiento de diario manual

La mayoría de los asientos se registran automáticamente como se describió arriba, pero a veces necesita registrar algo a mano — corregir un gasto mal clasificado, registrar un ajuste sin efectivo, o cualquier asiento que no corresponda a uno de los tipos de transacción propios de Sarang. Abra **Journal Entries** y haga clic en **New Entry**.

Agregue dos o más líneas, cada una contra una cuenta, como débito o crédito — nunca ambos en la misma línea. Sarang suma ambas columnas a medida que escribe y se niega a registrar hasta que coincidan exactamente — un asiento que no está balanceado se rechaza de plano, la misma disciplina que ya sigue cualquier otro registro financiero en Sarang.

Los asientos ya registrados se pueden revertir (con un motivo obligatorio) si uno se ingresó por error — esto registra un asiento reflejado real en lugar de eliminar el original, de modo que la corrección misma pasa a formar parte del registro permanente.

## Bloqueo de transacciones (Transaction Locking)

Abra **Ledger Settings** para establecer una **Lock Date** — una vez establecida, ninguna transacción financiera fechada (una Factura, Factura de Proveedor, Pago, Pago a Proveedor, Gasto, Asiento de Diario u Orden de Compra) en esa fecha o antes puede crearse, editarse o anularse en ninguna parte de la aplicación. Esto es lo que mantiene cerrado un período contable cerrado — una vez que usted y su contador acuerdan que un mes o año es definitivo, la fecha de bloqueo impide que cualquiera (incluido usted) lo cambie silenciosamente después.

## Interés por mora en clientes

Si cobra intereses sobre saldos de clientes vencidos, active **Credit Interest** en Settings con una tasa y un tipo Simple o Compuesto. Luego, desde el propio registro de un cliente, puede ver el interés realmente acumulado en sus facturas vencidas — calculado por factura desde la fecha en que realmente venció, no una estimación plana sobre todo el saldo — y registrarlo como un cargo real en su cuenta cuando esté listo para facturarlo.

## Retención (RCM), Régimen de Composición y TDS

- **Reverse Charge (RCM)** — marque una Factura de Proveedor o Gasto como reverse-charge cuando el proveedor no le haya cobrado GST y usted lo esté autoevaluando en su lugar. Sarang mantiene separado lo que realmente debe al proveedor del impuesto que debe al gobierno, y muestra el total del impuesto de reverse-charge en el informe de vista previa de GSTR-3B.
- **Composition Scheme** — si su negocio está registrado bajo el Composition Scheme (configúrelo en Settings), cada Factura que emita no llevará GST alguno automáticamente, y se imprimirá como un **Bill of Supply** en lugar de una factura fiscal — coincidiendo con lo que exige la ley, sin que usted tenga que recordar poner el impuesto en cero manualmente en cada venta.
- **TDS sobre pagos a proveedores** — al registrar un pago a un proveedor, marque **Deduct TDS** y Sarang sugiere un monto basado en su umbral y tasa configurados, siempre revisable y ajustable antes de confirmar. El monto retenido se rastrea como su propio pasivo, separado de lo que realmente se pagó.

## Trial Balance

El informe **Trial Balance** (en Reports) lee directamente del libro mayor real descrito arriba — el saldo corriente de cada cuenta a la fecha que elija, con débitos y créditos que siempre suman el mismo total, ya que cada asiento que alguna vez se registró en él estuvo obligado a estar balanceado por sí mismo.
