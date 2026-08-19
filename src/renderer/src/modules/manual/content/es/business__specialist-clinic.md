# Clínica de Especialista

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Clínica de Especialista — parte de los mismos cuatro bloques de construcción: **Citas** (reservar y programar visitas), un **Catálogo de servicios** (la lista de consultas y procedimientos que ofrece su consultorio), **Provider Schedules** (qué especialista está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre lo específico de un consultorio de especialista.

Sarang deliberadamente no tiene un tipo de negocio separado por cada especialidad médica (ORL, oftalmología, dermatología, cardiología, etcétera). En cambio, "Clínica de Especialista" está construida para cubrir **cualquier especialidad** a través del mismo Service Catalog genérico — usted define sus propios tipos de consulta y procedimiento con sus propios precios, y la nota clínica de abajo se adapta para llevar campos específicos de especialista sin importar cuál sea su especialidad.

## Notas de Consulta con Datos de Derivación

Abrir la **Consultation Note** de una cita le da la misma nota SOAP estructurada usada en todos los tipos de negocio clínicos de Sarang (Patient Information, Subjective, Vitals con marcado automático, Objective, Assessment, Plan, Follow-up) — vea el capítulo de *Clínica Médica General* para el recorrido completo campo por campo — más una sección de **Referral Details** exclusiva de Clínica de Especialista:

- **Referred By** y **Referral Date** — registra quién le envió a este paciente (un médico externo u otra clínica) y cuándo.
- **Referral Reason** — texto libre.
- **Referring Doctor's Phone** y **Referring Doctor's Email** — datos de contacto opcionales del médico que deriva. Estos son los que le permiten cerrar el ciclo: una vez que la nota está finalizada, aparece un botón **Share** junto a Print Summary que envía al médico que derivó un resumen de la visita por WhatsApp o Email (como PDF), para que sepa qué pasó con el paciente que le envió. El botón solo aparece cuando hay un médico derivante registrado en la nota y la nota está finalizada — un borrador todavía no es un resultado real para enviar. Si deja el teléfono o el correo en blanco, la opción de compartir correspondiente simplemente queda deshabilitada, no falla.

Esto es independiente de **Refer to Another Provider**, una acción real dentro de la app más abajo en la misma pantalla: una vez guardada la nota, puede reservar una cita saliente real con otro proveedor de su propia clínica (elija el proveedor, fecha, hora, y un motivo opcional) — esta es una cita reservada genuina, no solo una nota. Cada derivación que envía muestra su propio estado (Programada / Completada / Cancelada / No Asistió) justo ahí en la nota de visita, con un botón de **Print Referral Letter** que produce una carta formal dirigida al proveedor al que se deriva.

Una casilla separada **"This is a second-opinion consultation"** en la misma sección marca una visita en la que el paciente ya fue diagnosticado o tratado en otro lugar y acudió específicamente para otra opinión — distinto de una derivación, ya que una visita de segunda opinión no requiere que nadie lo haya enviado, y un paciente derivado no necesariamente busca una segunda opinión. Una nota marcada muestra una insignia **Second Opinion** junto al título de la nota, y alimenta el informe de Conversión de Segunda Opinión más abajo.

Un menú desplegable **Case Complexity** justo después de la sección Assessment le permite etiquetar una visita como **Routine** o **Complex** — déjelo sin definir si prefiere no clasificar una visita en particular; las notas sin definir simplemente se excluyen del informe de Mezcla de Complejidad de Casos más abajo, en lugar de contarse como Rutinario por defecto.

La nota también lleva la misma tabla de **Prescription** detallada y el gráfico de **Vitals Trend** descritos en el capítulo de *Clínica Médica General* — ambos funcionan de forma idéntica aquí.

## Cola de Turnos

Clínica de Especialista también incluye la pantalla de **Cola de turnos** para pacientes sin cita previa del mismo día, exactamente como se describe en el capítulo de *Clínica Médica General* — emita turnos para pacientes sin cita, llame al próximo paciente, y siga los conteos de Esperando / Llamado / Atendido / Omitido. Las colas sin cita previa son tan comunes en consultorios ambulatorios de especialista (campañas de ORL, campañas de oftalmología, clínicas de dermatología) como en la medicina general.

Una adición aquí exclusiva de Clínica de Especialista: el formulario **Add Walk-in** tiene una casilla **"Mark as urgent (referring doctor flagged this as urgent)"**. Un turno marcado como urgente muestra una insignia roja **Urgent** en la cola y se llama antes que los pacientes que se registraron antes — **Call Next** siempre elige el turno en espera de mayor prioridad, primero los pacientes urgentes, luego por orden de registro. Úselo para un paciente sin cita cuyo médico derivante marcó el caso como necesitado de atención más rápida, no como una herramienta de prioridad general — la mayoría de los pacientes sin cita deben pasar en el orden normal de registro.

## Impresión

**Print Summary** produce un resumen de visita formateado que incluye la sección de derivación cuando está completa, con el mismo descargo de responsabilidad clínico usado en todos los documentos médicos de Sarang: es un documento de conveniencia generado por Sarang, no un registro médico validado — verifique siempre antes de un uso clínico.

## Informes

Abra **Reports → Referral Leaderboard** para ver qué médicos derivantes le están enviando más pacientes en un rango de fechas — una lista clasificada con conteos, más un gráfico de barras de los diez principales. Este es el mismo campo real "Referred By" capturado en la Nota de Consulta, finalmente agregado en lugar de quedar sin usar por nota.

Abra **Reports → Second-Opinion Conversion** para ver, de las visitas que marcó como segunda opinión en un rango de fechas, cuántos de esos pacientes regresaron para una cita posterior completada y se convirtieron en pacientes continuos — un recuento total, un recuento de convertidos, y una tasa de conversión, más una fila por paciente con su fecha de visita y (si regresaron) su próxima fecha de visita. Solo se puede rastrear así a los pacientes vinculados a un registro de cliente real; un walk-in sin registro de cliente no se cuenta de ninguna manera.

Abra **Reports → Case-Complexity Mix** para ver la división entre casos Rutinarios y Complejos en un rango de fechas — un gráfico de barras apiladas mes a mes, más el total de casos etiquetados, los conteos de Rutinario y Complejo, y el porcentaje general de Complejo. Solo se cuentan las visitas donde configuró el menú Case Complexity; una visita sin etiquetar no se asume Rutinaria, simplemente se deja fuera de la mezcla.

Si usa **Refer to Another Provider** para enviar un paciente dentro de su propia clínica, una vez que ese proveedor finaliza su propia nota en la cita de derivación, su resultado aparece automáticamente en su nota original — sin necesidad de una búsqueda separada para saber qué pasó con un paciente que derivó.
