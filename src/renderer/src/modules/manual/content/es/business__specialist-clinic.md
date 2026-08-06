# Clínica de Especialista

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Clínica de Especialista — parte de los mismos cuatro bloques de construcción: **Citas** (reservar y programar visitas), un **Catálogo de servicios** (la lista de consultas y procedimientos que ofrece su consultorio), **Provider Schedules** (qué especialista está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre lo específico de un consultorio de especialista.

Sarang deliberadamente no tiene un tipo de negocio separado por cada especialidad médica (ORL, oftalmología, dermatología, cardiología, etcétera). En cambio, "Clínica de Especialista" está construida para cubrir **cualquier especialidad** a través del mismo Service Catalog genérico — usted define sus propios tipos de consulta y procedimiento con sus propios precios, y la nota clínica de abajo se adapta para llevar campos específicos de especialista sin importar cuál sea su especialidad.

## Notas de Consulta con Datos de Derivación

Abrir la **Consultation Note** de una cita le da la misma nota SOAP estructurada usada en todos los tipos de negocio clínicos de Sarang (Patient Information, Subjective, Vitals con marcado automático, Objective, Assessment, Plan, Follow-up) — vea el capítulo de *Clínica Médica General* para el recorrido completo campo por campo — más una sección de **Referral Details** exclusiva de Clínica de Especialista:

- **Referred By** y **Referral Date** — registra quién le envió a este paciente (un médico externo u otra clínica) y cuándo.
- **Referral Reason** — texto libre.

Esto es independiente de **Refer to Another Provider**, una acción real dentro de la app más abajo en la misma pantalla: una vez guardada la nota, puede reservar una cita saliente real con otro proveedor de su propia clínica (elija el proveedor, fecha, hora, y un motivo opcional) — esta es una cita reservada genuina, no solo una nota. Cada derivación que envía muestra su propio estado (Programada / Completada / Cancelada / No Asistió) justo ahí en la nota de visita, con un botón de **Print Referral Letter** que produce una carta formal dirigida al proveedor al que se deriva.

La nota también lleva la misma tabla de **Prescription** detallada y el gráfico de **Vitals Trend** descritos en el capítulo de *Clínica Médica General* — ambos funcionan de forma idéntica aquí.

## Cola de Turnos

Clínica de Especialista también incluye la pantalla de **Cola de turnos** para pacientes sin cita previa del mismo día, exactamente como se describe en el capítulo de *Clínica Médica General* — emita turnos para pacientes sin cita, llame al próximo paciente, y siga los conteos de Esperando / Llamado / Atendido / Omitido. Las colas sin cita previa son tan comunes en consultorios ambulatorios de especialista (campañas de ORL, campañas de oftalmología, clínicas de dermatología) como en la medicina general.

## Impresión

**Print Summary** produce un resumen de visita formateado que incluye la sección de derivación cuando está completa, con el mismo descargo de responsabilidad clínico usado en todos los documentos médicos de Sarang: es un documento de conveniencia generado por Sarang, no un registro médico validado — verifique siempre antes de un uso clínico.
