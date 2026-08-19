# Clínica de Fisioterapia

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Clínica de Fisioterapia — parte de los mismos cuatro bloques de construcción: **Citas** (reservar y programar visitas), un **Catálogo de servicios** (la lista de sesiones de terapia y sus precios), **Provider Schedules** (qué fisioterapeuta está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre lo específico de la fisioterapia: notas de consulta con puntuación de dolor, fases de tratamiento, programas de ejercicio en casa, y paquetes de sesiones.

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

La pestaña de **Paquetes de sesiones** sigue paquetes prepagados de sesiones (p. ej. "Paquete de Fisioterapia de 10 sesiones"): nombre del paquete, sesiones totales, precio, tasa de GST, fechas de compra y vencimiento. Un paquete activo muestra una barra de progreso de sesiones restantes, y cada cita completada contra ese paquete descuenta una sesión automáticamente. Una vez que un paquete tiene un precio, puede **Generar Factura** para él directamente desde esta pantalla — solo lo ofrece una vez, y marca el paquete como "Invoiced" después, para que nunca se facture dos veces.

La fila de filtros en la parte superior de la lista de Paquetes de Sesiones (**Todos / Activos / Bajos / Vencidos**, cada uno con un contador en vivo) es su vista de alertas: un paquete pasa a **Bajos** cuando quedan 2 sesiones o menos, y a **Vencidos** una vez que su fecha de vencimiento ha pasado — ambos se marcan con color también en la propia tarjeta del paquete, así que nunca tiene que abrir un paquete para notar que necesita atención.

Para ver cómo se están usando sus paquetes de sesiones en todos los pacientes, abra **Reports → Pack Utilization** y elija un rango de fechas. Muestra el total de paquetes vendidos, sesiones usadas frente a sesiones compradas, y un porcentaje de utilización general, más un gráfico de barras y una tabla completa desglosándolo paquete por paquete — para que pueda detectar de un vistazo paquetes mayormente sin usar (una señal para hacer seguimiento con ese paciente).

## Referencias

Si un paciente llega derivado por un médico externo, la sección **Detalles de Referencia** de la Nota de Consulta registra quién lo derivó, la fecha y el motivo — campos de texto libre, ya que el médico que deriva suele estar fuera de Sarang por completo. Si en cambio está enviando un paciente a otro proveedor dentro de su propia clínica, use **Derivar a Otro Proveedor** en su nota para reservar una cita real vinculada, el mismo mecanismo de derivación dentro de la app usado en los tipos de negocio clínicos de Sarang.

Una vez que ese proveedor finaliza su propia nota en la cita derivada, su resultado aparece automáticamente en su nota original. Si esa nota está siguiendo el Puntaje de Dolor y el Puntaje Funcional a lo largo de las sesiones, el resultado mostrado no es solo su comentario final — es un antes-y-después cuantificado a lo largo de todo el curso del tratamiento desde la derivación (por ejemplo, "Dolor 7→3, Función 40→75 en 3 sesiones"), para que pueda ver de un vistazo si la derivación realmente ayudó, no solo que ocurrió.
