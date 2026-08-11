# Activos Fijos y Cierre de Fin de Año

## El registro de Activos Fijos

Abra **Fixed Assets** desde la barra lateral y haga clic en **New Asset** para registrar algo que su negocio posee y usa a lo largo del tiempo — un vehículo, equipo, muebles, una laptop — en lugar de algo comprado para revender. Ingrese su fecha de compra, costo, vida útil (en meses), método de depreciación y valor de salvamento (lo que probablemente valdrá una vez totalmente depreciado, a menudo cero).

Agregar un activo aquí no registra un asiento de compra propio — la compra en sí ya se registró a través de una Factura de Proveedor o un Gasto cuando realmente lo compró. Este registro existe para rastrear lo que posee y depreciarlo correctamente con el tiempo, no para registrar la compra por segunda vez.

## Ejecutar la depreciación

Abra la pantalla de detalle propia de un activo y haga clic en **Run Depreciation** para un período. Sarang admite dos métodos:

- **Straight-Line** (línea recta) — la misma cantidad cada período: (costo − valor de salvamento) ÷ vida útil.
- **WDV (Written-Down Value, valor decreciente)** — un porcentaje decreciente del valor contable actual del activo en cada período, por lo que el monto de depreciación es mayor al principio y se reduce con el tiempo.

Cada ejecución registra un Journal Entry real (Débito a Depreciation Expense, Crédito a Fixed Assets) y actualiza la depreciación acumulada del activo. Ejecutar la depreciación dos veces para el mismo período está completamente bloqueado — Sarang no le permitirá registrarla dos veces por accidente.

## Dar de baja un activo (Dispose)

Cuando venda, deseche o dé de baja un activo, ábralo y haga clic en **Dispose**. Ingrese la fecha de baja y (si se vendió) el monto recibido. Sarang lo compara con el valor contable actual del activo y registra la diferencia como una ganancia o pérdida real — una venta por encima del valor contable es una ganancia, por debajo es una pérdida — para que la baja se refleje correctamente en sus libros, no solo se marque como inactiva.

## Cerrar su año fiscal

Al final del año, abra **Ledger Settings** y use **Year-End Close**. Esta es una acción real y permanente: calcula el saldo de cada cuenta a la fecha de cierre, incorpora el ingreso o pérdida neta del año a Owner's Capital (la práctica contable estándar de reiniciar a cero las cuentas de ingresos y gastos cada año, llevando adelante lo que realmente se ganó o gastó hacia el patrimonio), y registra un único asiento de apertura que traslada cada saldo al nuevo año.

Luego, la fecha de cierre se bloquea automáticamente mediante el mismo mecanismo de Transaction Locking descrito en el capítulo de Libro Mayor y Asientos de Diario — nada en el año cerrado puede editarse después, mientras que los datos de cada año cerrado permanecen completamente intactos y visibles, nunca eliminados ni archivados fuera de alcance.

Year-End Close se niega a ejecutarse nuevamente en un período ya cerrado, y se niega a ejecutarse en un período sin actividad real que trasladar — así nunca se ejecuta dos veces por accidente, y nunca registra un asiento vacío o sin sentido.
