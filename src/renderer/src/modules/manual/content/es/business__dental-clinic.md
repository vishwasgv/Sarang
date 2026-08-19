# Clínica Dental

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Clínica Dental — parte de los mismos cuatro bloques de construcción: **Citas** (reservar y programar visitas), un **Catálogo de servicios** (la lista de procedimientos dentales y sus precios), **Provider Schedules** (qué dentista está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre las dos herramientas específicas para odontología de Sarang: el odontograma y el calendario de recitación.

## Odontograma

Cada paciente dental tiene una pestaña de **Tooth Chart** que muestra un odontograma completo en notación FDI — tanto el arco permanente (adulto) como el arco deciduo (dientes de leche/primarios), superior e inferior. Haga clic en cualquier diente para registrar o actualizar su condición:

- Condiciones: Sano, Caries, Obturado, Ausente, Corona, Puente (pilar), Implante, Endodoncia, Sitio de Extracción, Fractura — cada una se muestra con su propio color en el odontograma.
- Para cualquier condición que no sea Sano o Ausente, marque qué **superficies** están afectadas (Bucal, Lingual, Mesial, Distal, Oclusal).
- Agregue notas clínicas de texto libre por diente.

Una leyenda arriba del odontograma muestra qué significa cada color, y puede **Print Chart** en cualquier momento para obtener una impresión tabular de cada diente con una condición registrada (que no sea Sano) — útil para derivaciones o registros de pacientes.

Haga clic en **History** en cualquier diente para ver su línea de tiempo cronológica completa — no solo sus cambios de condición, sino también cada procedimiento del plan de tratamiento que alguna vez mencionó este diente, fusionados en una sola línea de tiempo, la más reciente primero. Una entrada de condición muestra la condición y cualquier nota; una entrada de tratamiento muestra el procedimiento y de qué plan proviene, etiquetada **Treatment Planned** o **Treatment Done** según el propio estado de ese procedimiento. Volver a guardar un diente (digamos, de Caries a Obturado después del tratamiento) nunca borra la entrada anterior; ambas permanecen en la línea de tiempo para que tenga la historia completa de ese diente — qué se encontró, qué se propuso para él, y qué se hizo realmente.

## Planes de Tratamiento

La pestaña de **Treatment Plans** en la misma pantalla del paciente le permite construir planes de tratamiento detallados: un título, un estado (Propuesto / Aceptado / En Curso / Completado / Rechazado), y una lista de procedimientos, cada uno vinculado opcionalmente a un número de diente específico, con su propio costo estimado y una marca de Pendiente/Hecho. El costo total estimado del plan se calcula automáticamente a partir de sus líneas. Una vez que existe un plan, adjunte archivos de respaldo — una radiografía, un formulario de consentimiento escaneado — directamente desde su vista de edición.

Una vez que un plan avanza más allá de Proposed (Accepted, In Progress, o Completed) y aún no ha sido facturado, aparece una acción **Generate Invoice** — con un clic los procedimientos con precio del plan se convierten en una factura real para ese paciente, una línea por procedimiento (etiquetada por diente donde corresponda), y el plan entonces muestra una insignia **Billed**. Un plan solo puede facturarse una vez; un plan que todavía está en Proposed no puede facturarse en absoluto, ya que eso asumiría silenciosamente que el paciente ya dio su consentimiento.

## Calendario de Recitación

La pestaña de **Recall** (y la pantalla independiente de **Calendario de recordatorios**, que lista la recitación de cada paciente en toda la clínica) es el sistema de recordatorios de recitación dental de Sarang — el flujo cotidiano de "vuelva para su limpieza de los 6 meses." Para cada paciente usted configura:

- **Recall Type** — Higiene a 6 Meses, Higiene a 12 Meses, Revisión de Corona, o Personalizado.
- **Last Visit Date** y **Next Recall Date**.
- Notas opcionales.

La pantalla de Recall Schedule clasifica a cada paciente en **Atrasado**, **Due Soon** (dentro de 7 días), **Este Mes** (dentro de 30 días), o **Upcoming**, con conteos e insignias codificadas por color para cada banda, así siempre sabe a quién llamar a continuación. Aparece una insignia de "Reminded" una vez que se ha enviado un recordatorio para la recitación de ese paciente.

Cada vez que actualiza la recitación de un paciente que ya tenía una registrada, Sarang registra silenciosamente si ese período de recitación cerrado se cumplió a tiempo — la nueva Last Visit Date comparada con la fecha de recitación que estaba vencida antes de su actualización. Nunca ve esto directamente; alimenta el informe de Cumplimiento de Recitación de abajo.

## Informes

Abra **Reports → Treatment Acceptance Rate** para ver cuántos de los planes de tratamiento que propuso en un rango de fechas realmente se convirtieron en ingresos facturados — un embudo de tres etapas (Proposed → Accepted → Billed) como gráfico de barras, más la tasa de aceptación (aceptados ÷ propuestos) y la tasa de facturación (facturados ÷ propuestos) como porcentajes. Estos son los mismos datos reales de planes de la pestaña Treatment Plans, agregados en lugar de leídos paciente por paciente — una lectura rápida de si sus presentaciones de casos están convirtiendo, y si los planes aceptados realmente se están cobrando.

Abra **Reports → Recall Compliance** para ver, de los períodos de recitación cerrados en un rango de fechas, qué porcentaje de pacientes realmente regresó en su fecha de vencimiento o antes — un solo indicador para el porcentaje general, más un desglose por Tipo de Recitación (Higiene 6 Meses, Higiene 12 Meses, Revisión de Corona, Personalizado). Solo cuentan los períodos de recitación genuinamente cerrados (un paciente con una recitación existente recibiendo una nueva) — la primera recitación de un paciente no tiene una fecha de vencimiento previa con la que compararse, así que no se cuenta de ninguna manera.
