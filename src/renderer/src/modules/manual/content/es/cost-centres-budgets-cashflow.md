# Centros de Costo, Presupuestos y Flujo de Caja

## Centros de Costo

Un **Centro de Costo** (`/cost-centres`) es una etiqueta — un departamento, sucursal o proyecto — que puede asociar a una factura, una cuenta por pagar, un gasto o un empleado para ver las ganancias y los gastos desglosados por esa etiqueta en lugar de solo a nivel de toda la empresa. Cada negocio comienza sin centros de costo, así que nada de esto aparece en ningún otro lugar hasta que cree su primer centro de costo con **Nuevo Centro de Costo** (un nombre y un código corto opcional).

Una vez que existe al menos un centro de costo, aparece un selector opcional de **Centro de Costo** en la pantalla de pago de la factura, el formulario de Cuenta por Pagar, el formulario de Gasto y el formulario de Empleado — déjelo en blanco y nada cambia; elija uno y cada asiento contable que genere esa transacción llevará la misma etiqueta. El centro de costo propio de un empleado también etiqueta automáticamente su gasto salarial cuando la nómina lo marca como pagado, de modo que el costo de personal se agrupa por departamento sin tener que volver a etiquetar cada recibo de sueldo a mano.

## Presupuestos

**Presupuestos** (`/budgets`) le permite planificar una cifra mensual — para un centro de costo específico, una cuenta específica o toda la empresa — y luego ver cómo se comparó el gasto real una vez que el mes está en curso. Elija el mes con las flechas en la parte superior y luego **Nuevo Presupuesto** para fijar un importe frente a un alcance: deje tanto Centro de Costo como Cuenta en blanco para una cifra a nivel de toda la empresa, defina solo un Centro de Costo para un presupuesto de todo un departamento, o defina ambos para uno de alcance más acotado. La lista muestra Presupuestado, Real y Varianza uno junto al otro para el mes que está viendo — Real siempre son datos reales de transacciones, nunca estimados, así que un presupuesto frente a un centro de costo que aún no ha tenido ningún gasto muestra honestamente cero en lugar de un vacío.

No puede crear dos presupuestos para exactamente el mismo alcance y período — en su lugar, edite el existente, de modo que "cuánto presupuestamos para Marketing este mes" siempre tenga una sola respuesta.

## Informe de P&G por Centro de Costo

En Informes, **P&G por Centro de Costo** muestra los ingresos, gastos y margen reales por centro de costo para cualquier rango de fechas que elija, extraídos de las mismas transacciones etiquetadas que lee la pantalla de Presupuestos. Los ingresos y gastos que nunca se etiquetaron a ningún centro de costo se muestran por separado como un total "sin etiquetar", en lugar de omitirse silenciosamente — así los totales del informe siempre reflejan todo, etiquetado o no.

## Resumen de Cumplimiento Legal

Sarang nunca aplica automáticamente las reglas oficiales del gobierno para PF/ESI/Impuesto Profesional — esas cambian con cada notificación gubernamental, y una cifra confiadamente incorrecta es peor que un campo vacío. En cambio, si ingresa su propio % de PF, % de ESI (con un tope salarial opcional) y el importe del Impuesto Profesional en **Configuración → Perfil del Negocio**, la pantalla de Nómina obtiene un enlace **Sugerir según tasas legales** junto a la sección de Deducciones de cada recibo de sueldo. Este rellena previamente líneas de deducción sugeridas a partir de sus propias tarifas configuradas — usted igual revisa, edita o elimina cualquier línea, y aun así debe presionar Guardar para que cuente. Nunca se sugiere nada para una tarifa que no haya configurado.

El informe **Resumen de Cumplimiento Legal** (en Informes) totaliza lo que realmente registró — cada línea de deducción de cada recibo de sueldo del mes, agrupada por nombre — como una cifra real de responsabilidad del empleador para PF, ESI, Impuesto Profesional o cualquier otra cosa que haya nombrado como deducción, ya sea que provenga de una sugerencia o se haya escrito a mano.

## Proyección de Flujo de Caja

El informe **Proyección de Flujo de Caja** (en Informes) muestra un gráfico día a día dividido en dos mitades que se encuentran en el día de hoy: una línea sólida de movimiento de caja **real** del último mes (dinero realmente recibido menos los gastos y pagos a proveedores realmente realizados), y una línea discontinua de caja **proyectada** para el próximo mes — construida a partir de las facturas y cuentas por pagar abiertas según sus propias fechas de vencimiento, más cualquier gasto recurrente programado para vencer en esa ventana. Es una vista de planificación, no una garantía: solo se proyectan los documentos con una fecha de vencimiento real, y solo se pronostican los perfiles de *gasto* recurrentes (el importe futuro exacto de una factura o cuenta por pagar recurrente no se estima, para evitar una cifra confiadamente incorrecta).

## Rendimiento de Pagos

El informe **Rendimiento de Pagos** (en Informes) muestra, por cliente, cuántos días tardó realmente en cobrarse una factura por completo — medido desde la fecha de la factura hasta la fecha de su *último* pago, de modo que un cliente que paga en tres cuotas solo se cuenta una vez que realmente terminó de pagar. Las facturas que aún tienen saldo pendiente aparecen como pendientes en lugar de distorsionar el promedio con un pago que aún no se ha completado. Úselo para ver qué clientes pagan de manera confiable rápido y cuáles consistentemente tardan más, tanto por cliente como en un promedio general.
