# Guía: El dinero y tu contabilidad

Cómo lo que haces cada día (vender, comprar, pagar, gastar) se convierte en tu contabilidad, y cómo leer los estados. Esto es para tus propios registros y tu planificación; no sustituye el consejo de tu contador o CA.

## 1. Cómo tu trabajo diario se convierte en tu contabilidad

No necesitas hacer asientos contables para el trabajo normal. Sarang los registra por ti:

| Haces esto | Sarang registra |
|---|---|
| Haces una venta (factura) | Lo que te debe el cliente (o caja o banco si se pagó), el ingreso por ventas y el impuesto que cobraste |
| Recibes un pago | Caja o banco sube, lo que debe el cliente baja |
| Recibes stock en una Orden de compra | El stock y lo que debes al proveedor suben |
| Registras una Factura del proveedor | Lo que debes al proveedor sube; se registra el costo o el stock |
| Pagas a un proveedor | Caja o banco baja, lo que debes baja |
| Registras un Gasto | El gasto sube, caja o banco baja (o lo que debes sube) |
| Emites una Nota de crédito o una Nota de débito | La venta o la compra se reduce, y también el saldo |
| Registras la depreciación de un Activo fijo | El gasto por depreciación sube, el valor del activo baja |
| Un cliente retiene TDS al pagar | La factura queda saldada; "TDS por cobrar" (impuesto que reclamarás como crédito) sube en lugar de caja |
| Pagas GST al gobierno (Contabilidad, Pagos de GST) | El impuesto que debes y el crédito fiscal usado bajan, caja o banco baja |
| Apruebas y repones un gasto de un empleado | Se registra un gasto normal y caja o banco baja |

Cada asiento tiene dos lados que siempre son iguales (los débitos igualan a los créditos). Por eso la contabilidad cuadra.

## 2. Plan de cuentas

**Accounting → Chart of Accounts** es la lista de cuentas que usa tu contabilidad, agrupadas: Activos (caja, banco, cuentas por cobrar, stock, activos fijos), Pasivos (cuentas por pagar, impuesto por pagar, préstamos), Patrimonio (tu capital y las ganancias), Ingresos y Gastos. Sarang crea las cuentas estándar por ti. Agrega las tuyas (por ejemplo un nuevo préstamo bancario o un gasto especial) con **Add Account**.

Haz clic en **Ledger** en cualquier cuenta para ver cada asiento en ella (ver sección 5).

## 3. Asientos de diario: ajustes que no son una venta ni una compra

**Accounting → Journal Entries → New.** Usa un asiento de diario para lo que no es una venta o compra normal: un saldo inicial, una baja, el dueño que aporta o retira dinero, corregir un asiento anterior. Agrega líneas, cada una con una cuenta y un débito o un crédito. **El total de débitos debe igualar al total de créditos** o Sarang no lo guardará. Los asientos registrados pueden revertirse (con un motivo), no eliminarse, así que siempre queda un rastro.

Ayudas en el formulario de asiento:

- **Plantillas (patrones)**: después de llenar las cuentas y en qué lado va cada una, guarda el esquema con un nombre (por ejemplo *Alquiler mensual*). La próxima vez elígelo y solo escribe los importes. Guardar con un nombre existente lo reemplaza.
- **Revertir automáticamente el**: para un devengo (un gasto que registras ahora y que corresponde al mes siguiente), elige la fecha en que el asiento debe deshacerse solo. Sarang lo hace la próxima vez que se abre en o después de esa fecha, con la fecha del día en que se ejecuta. Si el período está bloqueado, la reversión espera.
- **Notas memorándum** (desplegable al pie de Asientos de diario): notas sobre cosas que todavía no son asientos contables, como mercancía enviada a prueba. Nunca cambian tu contabilidad.
- **Teclado**: presiona **Enter** en el último importe para agregar una línea de cuadre y **Ctrl + Enter** para guardar.

## 4. El dinero en el banco

- **Cuentas bancarias**: agrega cada cuenta bancaria, luego **Reconcile**: importa o escribe las líneas del extracto bancario y compáralas con lo que Sarang ya registró, para que tu contabilidad concuerde con el banco.
- **Cheques posdatados**: lleva el control de los cheques que diste o recibiste para una fecha posterior.
- **Depósitos bancarios**: registra un depósito de efectivo y cheques al banco.
- **Cierre de caja** (diario): cuenta el efectivo en la caja y registra cualquier diferencia.
- **Reglas bancarias** (Accounting → Bank Rules): dile a Sarang que una línea del extracto que contiene ciertas palabras (por ejemplo "electricidad") pertenece a una cuenta determinada. La pantalla lista las líneas importadas que coinciden con las reglas; un clic las registra en esa cuenta y las marca conciliadas. Las reglas nunca se ejecutan solas y una línea registrada se puede deshacer desde la pantalla de conciliación.
- **Gastos**: registra cada costo del negocio con una categoría, un proveedor y si el impuesto lo pagas tú (reverse charge).
- **Reembolso de gastos** (Accounting → Expense Claims): cuando el personal paga algo de su propio bolsillo, registra el reclamo, luego **Approve** (o **Reject**) y **Repay**. Reembolsar registra un gasto normal con el método de pago que elijas.

## 5. Los estados, y cómo leer cada uno

Abre **Reports** y elige el grupo **Financial**. Elige un rango de fechas y ejecuta el informe. Cada uno tiene una fila de resumen, un gráfico y una tabla; puedes imprimir, exportar a Excel o PDF, o compartir.

**Estado de resultados (Profit and Loss).** Ingresos menos costos de un período: ingresos, costo de lo vendido, ganancia bruta, gastos por categoría, ganancia neta. *Pregunta que responde:* ¿gané dinero este mes?

**Cómo aparece el stock en tu contabilidad.** Sarang mantiene el stock como lo hacen Tally y Zoho Books. La mercancía que compras en una factura de proveedor (o una Orden de compra recibida) entra al activo **Inventario**, no a los gastos. Al vender, el costo de lo vendido sale de Inventario hacia **Costo de lo vendido**, usando el costo al momento de la venta. Una devolución regresa la mercancía a ese costo. Los servicios en una factura (flete, alquiler) son gastos. Una diferencia de conteo de stock, un daño o un vencimiento se registra contra Costo de lo vendido. El stock que escribes a mano (stock inicial) se registra contra el Capital del dueño. Por eso el Balance, el estado de resultados y el informe de Ventas cuentan la misma historia. Si actualizaste desde una versión anterior, tu stock existente se incorporó a la contabilidad una vez, a su costo, al primer inicio; las ventas hechas antes de la actualización no tienen asiento de costo de lo vendido, así que empieza tu primer período de resultados desde la fecha de la actualización.

**Balance general (Balance Sheet).** Lo que el negocio tiene y debe **en una fecha**: activos de un lado, pasivos más tu patrimonio del otro, y una línea de control que muestra que son iguales. La ganancia del período actual se incluye en el patrimonio para que cuadre. Elige **Compare with** una fecha anterior para ver qué cambió. *Pregunta que responde:* ¿cuánto vale mi negocio en papel, y cuánto se debe?

**Estado de flujo de efectivo (Cash Flow Statement).** De dónde vino el efectivo y a dónde fue en un período: de operar el negocio (operativo), de comprar o vender activos (inversión), y de préstamos y dinero del dueño (financiamiento), desde el efectivo inicial hasta el final. Una insignia "reconciled" muestra que el efectivo de cierre concuerda con tus cuentas de caja y banco. *Pregunta que responde:* soy rentable, ¿entonces por qué no hay efectivo?

**Balance de comprobación (Trial Balance).** El total de débito o crédito de cada cuenta en el período. Si los débitos igualan a los créditos, la contabilidad cuadra. Haz clic en cualquier fila para abrir el libro mayor de esa cuenta.

**Libro mayor (General Ledger).** Elige una cuenta y un rango de fechas. Obtienes el saldo inicial, cada asiento con un saldo corriente, y el saldo final, cada uno con el documento del que viene (una factura, una compra, un pago, un asiento). Las facturas y compras enlazan directo al documento. Ábrelo desde **Chart of Accounts → Ledger**, desde una fila del **Trial Balance**, o desde la lista de Reports. *Pregunta que responde:* ¿por qué esta cuenta muestra este número?

**Libro diario (Day Book).** Cada asiento en orden de fecha, filtrable por tipo (ventas, compras, cobros, pagos, asientos de diario). Totales por día. *Pregunta que responde:* ¿qué pasó este día?

**Libro de caja (Cash Book).** Un registro día por día de cada pago recibido y cada pago o gasto hecho, con un saldo corriente.

**Más informes para tu contador y para ti** (todos en la lista de Reports, cada uno con un gráfico):

- **Análisis de razones (Ratio Analysis)** (liquidez, deuda, márgenes, días de clientes, proveedores y stock) y **Flujo de fondos (Fund Flow)** (origen y uso de los fondos).
- **Libro bancario (Bank Book)** y **Resumen de conciliación bancaria**.
- **Resumen de cuentas por cobrar** y **Resumen de cuentas por pagar** (quién debe qué y qué vence en los próximos 7 días), **Ganancia por artículo** y **Ganancia por cliente**, **Año contra año**.
- **Ganancia por categoría de costo** (ingresos, gastos y ganancia sumados por la categoría que diste a cada centro de costo) y **Presupuesto contra real (Budget vs. Actual)**.
- **Gastos por categoría** y **Gastos por proveedor**, **Registro de activos fijos**.
- **Registros de Nota de crédito, Nota de débito y Devolución de venta**.
- **TDS retenido**, **TDS por cobrar** y (para negocios con GST) **GST Net Payable & Input Credit**.

Algunos informes también se pueden guardar automáticamente en una carpeta según un horario (Settings → Business Features → Reports saved automatically); esto solo funciona mientras Sarang está abierto.

## 6. Verificaciones que vale la pena hacer cada mes

1. **Trial Balance**: los débitos igualan a los créditos.
2. **Balance general**: los activos igualan a los pasivos más el patrimonio.
3. **Conciliación bancaria**: el saldo bancario en Sarang iguala al extracto bancario.
4. **Cuentas por cobrar y por pagar**: el informe Outstanding y el AP Aging Summary concuerdan con los saldos de clientes y proveedores.
5. **Valor del stock**: el total de Inventario es razonable frente a tu último conteo.
6. Envía el **Estado de resultados**, el **Balance general** y el **Tax Report** del mes a tu contador.

## Presupuestos, centros de costo y varias tiendas

- **Centros de costo** etiquetan los ingresos y gastos por departamento o proyecto. Da a cada centro de costo una **categoría** (por ejemplo Departamento o Proyecto) y **Profit by Cost Category** los suma.
- **Presupuestos** fijan un importe planeado por mes. Junto a tu plan real (el **Base plan**) puedes crear **planes hipotéticos**: elige **New what-if plan**, nómbralo y sube o baja cada cifra un porcentaje. **Budget vs. Actual** sigue el plan que elijas.
- **¿Varias tiendas o sucursales?** Cada tienda mantiene su propio Sarang. **Accounting → Branch Summaries** exporta un archivo resumen de cada tienda y los importa en un solo lugar para que el dueño vea todas las tiendas juntas. Nada se sincroniza solo.

## Moneda extranjera

Mantén una tabla de tipos de cambio en **Settings → Business Features → Exchange rates** (agrega tasas a mano o importa un CSV). Al hacer una venta en moneda extranjera, se completa la tasa más reciente. Los pagos recibidos en esa moneda registran la ganancia o pérdida cambiaria.

## 7. Bloquear un período terminado

**Accounting → Ledger Settings** te permite fijar una **fecha de bloqueo**. Nada con fecha en ella o antes puede agregarse, cambiarse o revertirse, lo que protege las cifras que tu contador ya usó para una declaración o una auditoría. Fíjala solo después de que tu contador confirme el período.

## 8. Cierre de año

**Fixed Assets and Year-End Close** (su propio capítulo) cubre registrar la depreciación y cerrar el año. Después de un cierre, los saldos iniciales del nuevo año se trasladan automáticamente. Los informes que muestran un saldo en una fecha empiezan desde el último asiento de apertura.

## Compartir tu contabilidad con tu contador

Crea un acceso para tu contador con el rol **Accountant**: puede ver informes, libros mayores y estados y exportarlos, y no puede cambiar nada. Agrégalo en **Settings → Users**. Envíale el Estado de resultados, el Balance general y el Tax Report del mes, o exporta el Trial Balance para él.

## Preguntas frecuentes

**¿Por qué la ganancia no es igual al efectivo que tengo?** La ganancia cuenta ventas que aún no cobraste y compras que aún no pagaste. El Estado de flujo de efectivo muestra la diferencia.

**¿Por qué mi Balance general está descuadrado?** Nunca debería estarlo. Si lo está, no lo corrijas a mano: revisa si hay un bloqueo de período en medio del rango, anota la diferencia y rastréala en el Libro mayor con tu contador.

**¿Puedo eliminar un asiento?** Los asientos se revierten, no se eliminan, así el registro queda completo. Usa Void, Cancel, Reverse o una Nota de crédito o débito, según lo que ofrezca la pantalla.
