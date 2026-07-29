# Abogado / Práctica Legal

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Abogado / Práctica Legal — parte de los mismos cuatro bloques de construcción: **Appointments** (reservar reuniones con clientes), un **Service Catalog** (la lista de servicios legales y sus precios), **Provider Schedules** (qué abogado está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre las herramientas dedicadas para práctica legal de Sarang: gestión de casos y seguimiento de tiempo.

## Casos Legales

La pantalla de **Legal Cases** es un espacio de trabajo completo de gestión de casos con tres pestañas:

- **Cases** — cada caso con su número de caso, título, tribunal, cliente, próxima fecha de audiencia, y estado (Activo / Suspendido / Resuelto / Cerrado / Transferido). Agregue un nuevo caso con número de caso, título, tipo de caso (Civil, Penal, Familia, Corporativo, Propiedad, Arbitraje, Otro), nombre/distrito/estado del tribunal, un ID de caso opcional de eCourt (que agrega un enlace rápido al portal de estado de casos de eCourts), el cliente, el abogado a cargo, fecha de presentación, y honorario acordado. Los indicadores de KPI en la parte superior muestran Active Cases, Today's Hearings, Hearings in 3 Days, y conteos de Closed/Disposed.
- **Upcoming Hearings** — cada audiencia programada en todos los casos, filtrable a Upcoming / Today / All, con la posibilidad de marcar una audiencia como **Done** o **Adjourn** (registrando un resultado y la próxima fecha de audiencia) directamente desde la lista.
- **Time Entries** — cada hora facturable registrada en todos los casos, filtrable a Unbilled / Billed / All, con un total continuo del valor no facturado.

Abrir un caso muestra su detalle completo: información del caso, una lista continua de audiencias (agregue una con fecha, hora, sala de tribunal, y propósito — Argumentos, Evidencia, Fijación de Cuestiones, Sentencia, Audiencia de Fianza, Orden Provisional, Otro), y sus registros de tiempo. Desde aquí también puede marcar el caso como **Closed** o **Disposed**, adjuntar documentos del caso (peticiones presentadas, órdenes judiciales, pruebas escaneadas), y establecer una fecha de prescripción/plazo.

## Verificación de conflicto de intereses

Cuando crea un nuevo caso, ingrese tanto el cliente como un **nombre de la parte contraria**. Sarang verifica — en ambas direcciones — si la parte contraria propuesta ya es cliente en otro lugar, o si el cliente propuesto fue registrado previamente como parte contraria en otro caso. Si cualquiera de los dos es cierto, aparece un banner de advertencia en el formulario de Nuevo Caso mostrando el motivo. Esta verificación es solo informativa — nunca bloquea el guardado del caso — ya que un conflicto real requiere su propio juicio profesional, no el de una computadora.

## Recordatorios de prescripción / plazo

Establezca una **fecha de prescripción** en un caso (al crearlo, o después desde el panel de detalle del caso) para que Sarang siga su plazo de prescripción o fecha límite de presentación. Recibirá un recordatorio automático de WhatsApp 30 días antes y de nuevo 7 días antes de la fecha, dando suficiente tiempo para reunir documentos e instrucciones. Cambiar la fecha cancela los recordatorios anteriores y programa unos nuevos — nunca necesita seguir esto a mano.

## Registros de Tiempo

El tiempo se puede registrar ya sea desde dentro de un caso (en la pantalla de Legal Cases) o desde la pantalla independiente de **Time Tracking**, que lista cada registro en todos los casos con fecha, miembro del personal, descripción, horas, tarifa, y monto calculado. Filtre por personal, rango de fechas, o estado de facturación. Seleccione uno o más registros no facturados y haga clic en **Generate Invoice** para convertir las horas registradas directamente en una factura real para el cliente — los registros facturados ya no se pueden editar ni eliminar, manteniendo intacto el rastro de facturación.
