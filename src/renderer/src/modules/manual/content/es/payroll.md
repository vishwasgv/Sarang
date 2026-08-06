# Nómina

Abra **Nómina** desde la barra lateral para generar, revisar y pagar el salario mensual de cada empleado — construido sobre los mismos registros de Empleados e historial de Asistencia cubiertos en el capítulo de RR. HH. de este Manual. Ver la lista de nómina e imprimir un recibo de sueldo solo requiere el permiso **View HR**; generar la nómina, editar deducciones y marcar un recibo de sueldo como pagado requieren **Manage HR**.

## Elegir un período

Use las flechas **◀** / **▶** junto al nombre del mes para moverse entre períodos. La nómina se genera y rastrea un mes calendario a la vez, para cada empleado activo.

## Generar la nómina

Toque **Generar Nómina para Este Período** para crear un recibo de sueldo en borrador para cada empleado activo que aún no tenga uno para el mes seleccionado — volver a ejecutarlo para el mismo mes solo completa los faltantes, nunca crea un duplicado para alguien ya generado. El **Salario Bruto** de cada recibo de sueldo es el Salario Básico del empleado más sus Asignaciones configuradas (ambos definidos en el propio registro del empleado), y cuánto de ese bruto gana realmente un empleado en el mes depende de su Tipo de Salario:

- **Mensual** — el salario bruto completo, sin verse afectado por descansos semanales, feriados o permisos aprobados. Solo se reduce por ausencia real no justificada: cada día **Ausente** descuenta una parte proporcional del bruto del mes, y cada **Medio Día** descuenta la mitad de eso.
- **Diario** — el Salario Básico se trata como una tarifa por día, pagada solo por los días efectivamente marcados como **Presente** (un Medio Día cuenta como medio día) ese mes, más las Asignaciones mensuales fijas adicionales.
- **Por Hora** — el Salario Básico se trata como una tarifa por hora, calculada de la misma manera que Diario pero suponiendo una jornada de 8 horas por cada día presente.

Todo esto se basa directamente en los registros de Asistencia de ese empleado para el mes — consulte la sección de Asistencia del capítulo de RR. HH. para ver cómo se marcan día a día.

## Revisar y ajustar un recibo de sueldo

Toque la fila de cualquier empleado para abrir su recibo de sueldo. Muestra el Salario Básico y cada línea de Asignación que suman hasta el Salario Bruto. Mientras un recibo de sueldo siga en estado **Borrador**, puede agregar **Deducciones** — un nombre y un importe (PF, ESI, Impuesto Profesional y TDS aparecen como botones de agregado rápido de un toque siempre que el modelo de impuesto de su negocio esté configurado como GST) — y quitar cualquier deducción que haya agregado, con el total de **Pago Neto** en la parte inferior recalculándose en vivo a medida que avanza. Toque **Guardar** para registrar sus cambios en la lista de deducciones.

El aviso que se muestra debajo de la lista de deducciones vale la pena leerlo: Sarang calcula el salario bruto y suma las deducciones que usted ingresa, pero no calcula los montos estatutarios de PF/ESI/TDS por usted — esas cifras deben provenir de su propio contador o de las reglas de nómina aplicables, y se ingresan aquí como simples líneas de deducción.

## Marcar un recibo de sueldo como pagado

Una vez satisfecho con las deducciones, elija un **Método de Pago** (Efectivo, Transferencia Bancaria, Cheque o UPI) y toque **Marcar como Pagado**, luego confirme. Esto bloquea el recibo de sueldo — las deducciones de un recibo de sueldo pagado ya no se pueden editar, y ahora muestra la fecha en que se pagó y el método usado en lugar del editor de deducciones.

## Imprimir un recibo de sueldo

Toque el ícono de impresora en cualquier fila de la lista, o **Imprimir Recibo de Sueldo** dentro de un recibo de sueldo abierto, para generar un recibo de sueldo imprimible para ese empleado y período — disponible tanto si el recibo de sueldo sigue siendo un borrador como si ya está marcado como pagado.
