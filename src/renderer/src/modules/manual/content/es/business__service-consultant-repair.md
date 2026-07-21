# Servicio / Consultor / Reparación

Estos son tres de los tipos de negocio originales y de propósito general de Sarang — para cualquier negocio que no encaje en una plantilla vertical específica pero que realice trabajo de proyectos, tickets o estilo de reparación: un contratista general, un consultor independiente, un pequeño taller de reparación, una empresa de soporte de TI y similares. Los tres ejecutan la interfaz de Sarang en el idioma normal que usted elija (estos tres no forman parte de las 24 plantillas verticales de servicio específicas, así que aquí no hay bloqueo de solo inglés).

Comparten un mismo modelo genérico subyacente — Proyectos, Órdenes de Trabajo, Tickets de Servicio, Seguimiento de Trabajo e Historial de Cliente — pero cada tipo de negocio activa una combinación diferente de este:

- **Servicio** obtiene Proyectos, Tickets de Servicio y Seguimiento de Trabajo — un negocio que hace tanto trabajo estilo proyecto como solicitudes de soporte ad hoc.
- **Consultor** obtiene solo Proyectos y Seguimiento de Trabajo, sin Órdenes de Trabajo ni Tickets de Servicio — una práctica pura de proyecto/horas facturables.
- **Reparación** obtiene Órdenes de Trabajo y Tickets de Servicio, sin Proyectos — un negocio construido en torno a artículos individuales que traen los clientes, no compromisos de múltiples tareas.

Los tres también obtienen **Historial de Cliente**, una vista unificada de todo lo vinculado a un cliente sin importar cuál de estos modelos lo produjo.

## Proyectos (Servicio, Consultor)

Un proyecto tiene un título, prioridad (Baja/Media/Alta/Urgente), un cliente y responsable opcionales, horas/monto estimados y una fecha de vencimiento. Pasa por cinco estados — Open (Abierto), In Progress (En Proceso), On Hold (En Espera), Completed (Completado), Cancelled (Cancelado) — que usted cambia libremente desde la vista de detalle del proyecto.

Abrir la pantalla de detalle de un proyecto le da dos cosas más:

- **Tasks** (Tareas) — una lista de verificación simple que va marcando; la lista de proyectos muestra una barra de progreso "hecho / total" calculada a partir de esto.
- **Work Logs** (Registros de Trabajo) — horas registradas contra el proyecto, cada una marcada como facturable o no facturable, con un total corriente mostrado tanto en la vista de lista como en la de detalle.

## Órdenes de Trabajo (Reparación, Servicio a través del modelo genérico)

Una orden de trabajo está construida para un artículo físico que un cliente entrega: un título, descripción del artículo, prioridad, costo estimado y fechas de recepción/esperada/entrega. Tiene su propio ciclo de vida de siete etapas — **Received (Recibido) → Diagnosing (Diagnosticando) → In Repair (En Reparación) → (opcionalmente Pending Parts, Esperando Repuestos) → Ready (Listo) → Delivered (Entregado)**, o **Cancelled** (Cancelado) en cualquier punto antes de la entrega. La vista de detalle muestra esto como un rastreador visual de etapas y siempre destaca el único botón de siguiente acción (p. ej. "Marcar En Reparación"), además de una acción dedicada de "Esperando Repuestos" mientras una orden está en reparación. Entregar una orden de trabajo es donde ingresa el costo final real, separado de la estimación original — **Generar Factura** convierte ese costo final en una factura real una vez que la orden ha sido entregada.

Agregue **repuestos usados** reales a una orden de trabajo desde su vista de detalle — busque un producto, establezca la cantidad, y Sarang lo descuenta de su inventario real (no una nota de texto libre); quitar un repuesto restaura el stock. Establezca un **período de garantía** en días al momento de la entrega, y una insignia real de En Garantía / Vencida se muestra automáticamente a partir de ese punto. Si el mismo artículo regresa por un problema de garantía, inicie una nueva orden de trabajo y vincúlela como un **reclamo de garantía** contra la original — el estado de garantía en vivo de la original se muestra directamente en el formulario de la nueva orden de trabajo.

## Tickets de Servicio (Servicio, Reparación)

Un ticket es una solicitud de soporte más liviana: título, descripción, prioridad, una etiqueta de categoría opcional, y un cliente/responsable opcionales. Pasa por **Open (Abierto) → In Progress (En Proceso) → Resolved (Resuelto) → Closed (Cerrado)**, y resolver uno le permite adjuntar una nota de resolución. Los tickets urgentes y no resueltos se destacan con un indicador de bandera roja en la lista para que no queden enterrados. Ingrese un monto y use **Generar Factura** para facturar un ticket resuelto.

## Facturación de Citas y Proyectos

Estos tres tipos de negocio también obtienen **Citas** (reserva, horarios de proveedores y recordatorios — vea los capítulos de *Facturación* y universales) para programar reuniones con clientes o horarios de entrega, y un Proyecto se puede facturar directamente con **Generar Factura** una vez que esté listo, de la misma manera que una Orden de Trabajo o Ticket.

## Seguimiento de Trabajo

Un único parte de horas combinado a través de lo que este tipo de negocio tenga activado — un Proyecto, una Orden de Trabajo o un Ticket — mostrando el total de horas, horas facturables y horas no facturables de un vistazo. Cada hora registrada aquí es facturable o no según su elección al momento de ingresarla, y cada entrada se vincula de vuelta al registro contra el cual se registró.

## Historial de Cliente

Para cualquier cliente, una vista expandible lista cada factura, proyecto, ticket de servicio y orden de trabajo vinculados a él en un solo lugar, cada uno mostrado con su propio estado y fecha — una forma rápida de responder "qué le ha hecho este cliente con nosotros antes" sin tener que buscar en pantallas separadas.
