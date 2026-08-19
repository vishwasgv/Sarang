# Clínica Médica General

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Clínica Médica General — parte de los mismos cuatro bloques de construcción: **Citas** (reservar y programar visitas), un **Catálogo de servicios** (la lista de consultas y sus precios), **Provider Schedules** (qué médico está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre lo específico de una clínica de medicina general: notas de consulta y una cola de turnos para pacientes sin cita previa.

## Notas de Consulta (Notas de Visita)

Abrir la **Consultation Note** de una cita le da una nota clínica estructurada, en formato SOAP:

- **Patient Information** — nombre, edad, motivo principal de consulta.
- **S — Subjective**: lo que reporta el paciente (historia, síntomas, inicio).
- **Vitals**: presión arterial (sistólica/diastólica), pulso, temperatura, altura, peso — cada campo se marca automáticamente (Normal / Bajo / Alto) contra una referencia de rango normal guardada al momento de guardar, así que las lecturas fuera de rango destacan de inmediato.
- **O — Objective**: hallazgos del examen.
- **A — Assessment**: diagnóstico / impresión clínica.
- **Diagnosis Category** (opcional): una breve etiqueta de categoría — Infección, Seguimiento de Enfermedad Crónica, Lesión, y similares — separada del texto libre de Assessment anterior. Etiquetar esto alimenta **Reports → Diagnosis-Category Trend**, así que elija de la lista sugerida o escriba la suya si ninguna encaja.
- **P — Plan**: plan de tratamiento, medicamentos, estudios solicitados.
- **Follow-up**: una fecha de seguimiento opcional e instrucciones.

Haga clic en **Save Note** a medida que avanza, y luego en **Finalizar** cuando la consulta esté completa. Una nota finalizada se vuelve de solo lectura (se muestra con una insignia de candado) — esto protege el registro clínico de ser alterado después del hecho. Puede **Print Summary** en cualquier momento para entregarle al paciente (o conservar en sus archivos) un resumen de visita formateado, que lleva un descargo de responsabilidad claro de que es un documento de conveniencia generado por Sarang, no un registro médico validado — verifique siempre antes de un uso clínico.

**Prescription.** Agregue una receta real como su propia lista detallada — nombre del medicamento, dosis, frecuencia, duración e instrucciones, una fila por medicamento — separada del campo de texto libre Plan de arriba. **Print Prescription** produce un documento de receta (℞) adecuado con la tabla de medicamentos detallada (a diferencia del resumen de visita general, este está pensado para servir como una receta real, así que no lleva el descargo "no es un registro validado" — solo necesita su firma/sello para ser válida).

**Vitals Trend.** Una vez que un paciente tiene dos o más visitas con signos vitales registrados, aparece un gráfico de tendencia que muestra cómo ha evolucionado una métrica elegida (presión arterial, pulso, temperatura o peso) a lo largo del tiempo — elija qué métrica graficar desde la fila de chips arriba del gráfico.

**Derivar a un paciente.** Use "Refer to Another Provider" para reservar una cita real con otro proveedor — una vez que existe, **Print Referral Letter** produce una carta formal dirigida al médico derivado con el motivo de la derivación, un documento genuinamente distinto del resumen completo de consulta, hecho para que el paciente lo lleve consigo. Una vez que esa cita de derivación ocurre y su propia nota se finaliza, la evaluación del proveedor derivado aparece aquí mismo como una línea de **Outcome** debajo de la derivación, para que no tenga que ir por separado a buscar su nota para ver qué encontraron.

**Resultado de Derivación Saliente.** Todas sus derivaciones salientes, en un solo lugar — abra **Reports → Referral-Out Outcome** y elija un rango de fechas. Verá cuántas derivaciones hizo, cuántas ya tienen un resultado registrado, y cuántas siguen pendientes, además de una tabla con cada derivación, su estado y su resultado (cuando esté disponible).

**Tendencia de Categoría de Diagnóstico.** Cada vez que etiqueta una Diagnosis Category en una nota de consulta, alimenta **Reports → Diagnosis-Category Trend** — elija un rango de fechas y verá un gráfico de líneas con una línea por categoría, mes a mes, más una tabla de desglose. Esto es independiente del texto de Assessment en sí: Assessment es su nota clínica de texto libre, mientras que la categoría es una etiqueta breve puramente para detectar patrones a lo largo del tiempo (p. ej. "las infecciones están aumentando este trimestre"). Las visitas sin categoría etiquetada aún cuentan hacia su total de visitas pero no aparecen en el gráfico, ya que no hay nada por lo cual agruparlas.

## Cola de Turnos

La pantalla de **Cola de turnos** gestiona a los pacientes sin cita previa del mismo día sin necesitar una cita reservada con anticipación. Muestra:

- Una pantalla grande de **Now Serving** con el número de turno actual y el nombre del paciente.
- Chips de conteo para Esperando / Llamado / Atendido / Omitido.
- **Add Walk-in** para emitir un nuevo turno (nombre del paciente, edad, género, teléfono, notas).
- **Call Next** para llamar al próximo turno en espera.

Cada turno en la lista se puede llamar, marcar como atendido, omitir o restablecer a en espera — la cola se reordena automáticamente en secciones de "Actualmente Llamado," "Esperando," y "Completado." Esto es completamente independiente de la lista de Appointments reservadas con anticipación — está hecho para la realidad de pacientes que simplemente llegan y esperan su turno.

Para ver qué parte de su día son pacientes sin cita frente a citas reservadas previamente, abra **Reports → Walk-in vs. Appointment Ratio** y elija un rango de fechas. Muestra su proporción total como un porcentaje, más un gráfico de barras día por día, para que pueda saber de un vistazo si su clínica funciona principalmente con citas reservadas o principalmente con personas que simplemente llegan.

## Recordatorio de Condición Crónica

Para pacientes con afecciones continuas — diabetes, hipertensión y similares — que necesitan seguimiento periódico sin importar si reservan una nueva cita, la pantalla **Chronic Recall** (en la barra lateral) le permite etiquetar a un paciente con una afección y un calendario de recordatorios, independiente de cualquier visita individual.

- **Tag Condition** — elija al paciente, nombre la afección (se sugieren las comunes como Diabetes e Hipertensión, pero puede escribir cualquier afección), opcionalmente registre cuándo fue diagnosticada, y establezca la fecha de esta visita más la próxima fecha de recordatorio en la que quiere que vuelva.
- La lista clasifica a cada paciente en seguimiento en **Overdue**, **Due Soon** (dentro de 7 días), **This Month**, y **Upcoming** — haga clic en cualquier paciente para registrar su visita de seguimiento real y establecer la próxima fecha de recordatorio, de la misma forma en que estableció la primera.
- Cada vez que registra un seguimiento, Sarang registra silenciosamente si ocurrió en la fecha de recordatorio programada o antes. Con el tiempo esto construye un **porcentaje de cumplimiento** real — mostrado en la parte superior de la pantalla y en la tarjeta Chronic Recall de su Dashboard — indicando qué proporción de los recordatorios realmente se cumplen, no solo cuántos están programados.
- Un paciente puede ser etiquetado con más de una afección a la vez (por ejemplo, diabetes e hipertensión juntas), cada una rastreada y recordada de forma independiente.

Esto es independiente de la propia fecha de **Follow-up** única de la Nota de Consulta anterior — esa es para "que vuelva después de esta visita específica"; Chronic Recall es para "este paciente tiene una condición continua que necesito seguir revisando, visita tras visita."

Esta misma cifra de cumplimiento también tiene su propio informe dedicado — abra **Reports → Recall Compliance**, elija un rango de fechas, y verá un indicador mostrando qué porcentaje de recordatorios cerrados en ese período se cumplieron a tiempo, además de un desglose por condición (para poder saber, por ejemplo, que sus recordatorios de diabetes están al 90% pero la hipertensión está fallando).
