# Clínica de Fisioterapia

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Clínica de Fisioterapia — parte de los mismos cuatro bloques de construcción: **Appointments** (reservar y programar visitas), un **Service Catalog** (la lista de sesiones de terapia y sus precios), **Provider Schedules** (qué fisioterapeuta está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre lo específico de la fisioterapia: notas de consulta con puntuación de dolor, fases de tratamiento, programas de ejercicio en casa, y paquetes de sesiones.

## Notas de Consulta

Abrir la **Consultation Note** de una cita le da la misma nota SOAP estructurada usada en todos los tipos de negocio clínicos de Sarang (vea el capítulo de *Clínica Médica General* para los campos base), más dos agregados específicos de fisioterapia:

- **Pain Score** — una escala de 0 (ninguno) a 10 (el peor), ingresada ya sea como número o tocando un botón de selección rápida.
- **Functional Score** — una escala de 0-100 (más alto = mejor función), que sigue qué tan bien puede el paciente realmente moverse y realizar tareas, junto con el dolor.
- **Treatment Given This Session** — texto libre que describe lo que realmente se hizo en la sesión (p. ej. terapia de ultrasonido, TENS, terapia manual, vendaje).

Una vez que un paciente tiene dos o más sesiones registradas, aparece un gráfico de **Vitals Trend** en su nota — cambie entre los chips de Pain Score y Functional Score para ver cualquiera de los dos graficado a lo largo del tiempo, así usted y el paciente pueden ver el progreso real (o su ausencia) de un vistazo en lugar de hojear notas pasadas.

## Fases de Tratamiento

El perfil de cada paciente de fisioterapia tiene una pestaña de **Treatment** que sigue su recorrido de rehabilitación a través de fases con nombre: Evaluación Inicial, Fase Aguda, Subaguda, Rehabilitación Activa, Mantenimiento, y Alta. Cada fase registra un título, fecha de inicio, objetivos, y — una vez que la cierra — una nota de resultado. Solo una fase está abierta ("activa") a la vez; cerrar una le permite comenzar la siguiente, construyendo una línea de tiempo clara de cómo progresó el paciente.

## Programa de Ejercicio en Casa (HEP)

La pestaña de **Exercise Program** le permite construir un Programa de Ejercicio en Casa imprimible para el paciente: una lista numerada de ejercicios, cada uno con un nombre, descripción de cómo realizarlo, y series/repeticiones/tiempo de sostén/frecuencia. **Print HEP** produce un folleto formateado con el membrete de la clínica y una línea de firma, y registra cuándo se imprimió por última vez.

## Paquetes de Sesiones

La pestaña de **Session Packs** sigue paquetes prepagados de sesiones (p. ej. "Paquete de Fisioterapia de 10 sesiones"): nombre del paquete, sesiones totales, precio, tasa de GST, fechas de compra y vencimiento. Un paquete activo muestra una barra de progreso de sesiones restantes, y cada cita completada contra ese paquete descuenta una sesión automáticamente. Una vez que un paquete tiene un precio, puede **Generate Invoice** para él directamente desde esta pantalla — solo lo ofrece una vez, y marca el paquete como "Invoiced" después, para que nunca se facture dos veces.
