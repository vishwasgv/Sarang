# Firma de Contador Público

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Firma de Contador Público — parte de los mismos cuatro bloques de construcción: **Appointments** (reservar reuniones con clientes), un **Service Catalog** (la lista de servicios y sus precios), **Provider Schedules** (qué contador/miembro del personal está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre las herramientas de Sarang para una práctica contable: seguimiento de plazos de cumplimiento, contratos con clientes, y seguimiento de tiempo.

## Tareas de Cumplimiento

La pantalla de **Compliance Tasks** es el rastreador de plazos de su firma en todos los clientes — impuesto a la renta, GST, TDS, presentaciones ante ROC/MCA, auditorías, y cualquier otra cosa que defina. Los indicadores de KPI muestran conteos de Overdue, Due Today, Due in 7 Days, y Filed/Done, así nada se escapa.

Agregue una tarea eligiendo un cliente, un título, categoría, fecha de vencimiento, prioridad (Baja/Normal/Alta/Urgente), y opcionalmente asignándola a un miembro del personal — o elija de la **Compliance Library** de su firma de plantillas de eventos recurrentes para autocompletar el título y la categoría. Use **Update** en cualquier tarea para moverla a través de Pending → In Progress → Filed/Done, registrando la fecha de presentación y un número de acuse de recibo una vez que realmente se presenta, y adjunte el documento presentado real o el recibo de acuse de recibo. Una nota en la parte inferior de la pantalla le recuerda que las fechas de cumplimiento mostradas aquí son para su propia conveniencia de seguimiento y siempre deben verificarse contra el calendario estatutario real.

### Presentaciones relativas a la AGM y listas de verificación de documentos del cliente

Abra **Clients & Checklists** desde la pantalla de Compliance Tasks para establecer la **fecha de AGM** de un cliente. Una vez establecida, Sarang genera automáticamente las tareas de presentación MGT-7, AOC-4, y ADT-1 con sus fechas de vencimiento estatutarias correctas (60/30/15 días después de la AGM respectivamente) — ya no necesita calcularlas e ingresarlas a mano. La presentación de la AGM en sí todavía debe agregarse manualmente, ya que su propia fecha de vencimiento depende de la programación de la junta, no de un desfase fijo.

El mismo modal también contiene una **lista de verificación de documentos** por cliente — siga qué documentos (PAN, Aadhaar, Estado de Cuenta Bancario, Certificado de GST, o cualquier elemento personalizado) se han recolectado. Use **Add Standard Checklist** para sembrar los 4 elementos más comunes con un clic, y luego marque cada uno como Recolectado o Pendiente a medida que llegan los documentos.

## Contratos

**Engagements** sigue las relaciones continuas con clientes más allá de tareas de cumplimiento puntuales: retenedores, auditorías, trabajo de asesoría, y contratos fiscales. Cada contrato tiene un título, tipo, estructura de honorarios (Fijo, Por Hora, o Retenedor Mensual con un día de facturación del mes elegido), fechas de inicio/fin, y estado (Activo / Completado / Pausado / Terminado). Los indicadores de KPI muestran Active Engagements, Monthly Retainer Revenue, y Fixed Fee Pipeline. Adjunte cartas de contrato y documentos de respaldo directamente desde el formulario de edición.

Para cualquier contrato activo con un monto de honorario, **Generate Invoice** crea una factura real para el período de facturación actual — un retenedor mensual se puede volver a facturar cada mes calendario (muestra "Invoiced" para el período actual una vez facturado, y se vuelve a abrir automáticamente el mes siguiente).

## Registros de Tiempo

La pantalla independiente de **Time Tracking** registra horas facturables contra clientes o proyectos — fecha, personal, descripción, horas, tarifa, monto calculado — filtrable por personal, proyecto, rango de fechas, y estado de facturación, con indicadores de KPI para Hours This Month, Unbilled Hours, y Unbilled Amount. Seleccione registros no facturados y **Generate Invoice** para facturarlos directamente; una vez facturado, un registro ya no se puede editar ni eliminar.
