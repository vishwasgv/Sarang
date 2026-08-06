# Arquitecto

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluido Arquitecto — parte de los mismos cuatro bloques de construcción: **Citas** (reservar reuniones con clientes), un **Catálogo de servicios** (la lista de servicios y sus precios), **Provider Schedules** (qué miembro del equipo está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre lo específico de una práctica de arquitectura: un embudo de prospectos, gestión de proyectos, seguimiento de tiempo, y el registro de planos.

## Prospectos

**Prospectos** es un embudo estilo Kanban de clientes potenciales: Abierto → Contactado → Propuesta → Ganado → Perdido. Arrastre una tarjeta de prospecto entre columnas para actualizar su estado, o agregue un nuevo prospecto con nombre, datos de contacto, empresa, origen (Referencia, Sitio Web, Visita Espontánea, Redes Sociales, Llamada en Frío, Otro), valor estimado, y un miembro del equipo asignado.

## Proyectos

**Service Projects** sigue cada contrato con clientes desde el contrato hasta la finalización — nombre del proyecto, tipo, etapa, estado (Activo / En Espera / Completado / Cancelado), valor total del contrato, fechas de inicio y fin esperado, y un miembro del equipo asignado. Cada proyecto puede llevar **hitos** — entregables con nombre y su propio monto y fecha de vencimiento — y una vez que un hito está completo, genere una factura para él directamente desde el proyecto.

## Registros de Tiempo

Registre horas facturables contra un proyecto desde la pantalla independiente de **Seguimiento de tiempo** — fecha, personal, descripción, horas, tarifa, y monto calculado — filtrable por personal, proyecto, rango de fechas, y estado de facturación. Seleccione registros no facturados y **Generar Factura** para facturar directamente al cliente.

## Registro de Planos

El **Registro de planos** es el diferenciador real y cotidiano de una práctica de arquitectura: para cada proyecto, siga cada plano que emite — número de plano, título, disciplina (Arquitectónica, Estructural, MEP, Paisajismo, Interior), número de revisión, estado (Borrador / Emitido para Revisión / Aprobado / Sustituido), y fecha de emisión. Cambie el estado de un plano directamente desde la lista a medida que avanza en la revisión, y adjunte archivos (los documentos reales del plano) a cada revisión de plano.

Los planos se agrupan por número de plano, con la revisión actual mostrada como la fila principal. Haga clic en **New Revision** para emitir la siguiente revisión de un plano — Sarang crea un registro genuinamente nuevo y separado y marca automáticamente el anterior como Sustituido, así siempre tiene una comparación real de Rev A frente a Rev B, no solo un campo que se sobrescribió. Abra **History** en cualquier plano para ver todas las revisiones pasadas.

Mover un plano a **Aprobado** requiere registrar quién realmente dio la aprobación — Sarang le pedirá el nombre del aprobador si aún no está registrado, y no permitirá que el cambio de estado se realice sin uno. Esto le da un rastro de aprobación de cliente genuino, no solo una etiqueta de estado.
