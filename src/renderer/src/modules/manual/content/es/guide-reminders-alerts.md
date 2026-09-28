# Guía: Recordatorios y alertas

Sarang te dice dos cosas distintas, en dos lugares distintos. Saber cuál es cuál elimina la mayor parte de la confusión.

| | **Alertas** (la campana) | **Recordatorios de WhatsApp** |
|---|---|---|
| Para quién es | **Tú** | **Tus clientes, proveedores o pacientes** |
| Dónde | Ícono de campana en la barra superior | **Reminders & Messages → WhatsApp Reminders** |
| Ejemplos | Stock bajo, respaldo hecho, recordatorios vencidos, verificación de base de datos | "Tu cita es mañana a las 10:00", "Tu pago está vencido", "Tu membresía termina en 7 días" |
| Qué haces | Haz clic: Sarang abre la pantalla a la que se refiere | Haz clic en **Send on WhatsApp**, luego presiona Enviar en WhatsApp |
| ¿Se envía automáticamente? | Se muestra automáticamente | **Nunca.** Sarang prepara el mensaje; tú siempre presionas Enviar |

## Alertas (la campana)

La campana muestra un número cuando algo necesita tu atención. Ábrela y haz clic en una alerta:

- **WhatsApp Reminders Due** abre la pantalla de WhatsApp Reminders.
- **Low Stock Alert** abre Inventory.
- **Auto-Backup Complete** y **Database Integrity Issue** abren Backup.
- **Compliance Tasks Generated** (firmas de CA y CS) abre Compliance.

Una alerta marcada **Open →** se puede hacer clic. Al hacer clic también se marca como leída. **Mark all read** limpia el número.

## Recordatorios de WhatsApp

Sarang prepara recordatorios a partir de lo que pasa en tu negocio y los lista en **WhatsApp Reminders**, en tres pestañas: **Pending**, **Sent** y **All**.

Para cada recordatorio pendiente ves para quién es, el mensaje y cuándo venció.

1. Haz clic en **Send on WhatsApp**. WhatsApp (la app de escritorio o WhatsApp Web) se abre con el número de la persona y el mensaje ya escrito.
2. Presiona **Send** en WhatsApp. Este paso siempre es tuyo.
3. De vuelta en Sarang, haz clic en el visto (**Mark as sent**) para que pase a *Sent*. Usa la cruz (**Dismiss**) para uno que decidas no enviar.

Un recordatorio **sin número de teléfono** muestra "No phone number, so this can't be sent". Agrega el número al cliente o proveedor, o descártalo. Solo los recordatorios que realmente se pueden enviar se pueden marcar como enviados. Un recordatorio cuyo número de teléfono es demasiado corto para ser real se marca **Failed** y no cuenta como listo para enviar: corrige el número en el cliente y el próximo recordatorio funcionará.

**Un cliente que pidió no recibir mensajes.** Marca **Do not send this customer messages** en el formulario del cliente. Sus recordatorios pendientes se eliminan, ya no aparecen como listos para enviar, y el botón puntual **Send WhatsApp Message** los rechaza.

### Qué genera recordatorios

- **Citas** (clínicas, salones, gimnasios y otros negocios basados en citas): un recordatorio **24 horas antes** y otro **2 horas antes** de la hora de la cita. Se cuentan desde la fecha y hora de la cita, así que una cita mañana a las 10:00 se recuerda hoy a las 10:00 y mañana a las 08:00. Una reserva hecha con menos de 24 horas de anticipación solo recibe el recordatorio de 2 horas; una hecha con menos de 2 horas no recibe ninguno.
- **Reprogramar o cancelar** una cita reemplaza o elimina sus recordatorios pendientes, así nadie recibe un recordatorio de una hora vieja. Las citas completadas, no presentadas y en curso también pierden sus recordatorios pendientes.
- **Sin teléfono en el cliente**: no se crea ningún recordatorio, y Sarang te avisa al reservar.
- **Pagos vencidos** (7, 14 y 30 días), **renovaciones de membresía y contrato**, **fechas de vacuna y recordatorio médico**, **cuotas pendientes**, **fechas de audiencia legal**, **envíos despachados o retrasados**, **mercancía recibida** (un agradecimiento al proveedor, solo si tiene número de teléfono), y muchos otros específicos del negocio.
- **Página del cliente → Send WhatsApp Message**: un mensaje puntual que escribes tú mismo.

### Enviar muchos a la vez

Los recordatorios vencen a lo largo del día. Sarang revisa cada hora mientras está abierto y pone una alerta **WhatsApp Reminders Due** en la campana. Si Sarang está cerrado, los recordatorios esperan; no se pierden, se muestran como vencidos la próxima vez que lo abres.

### Plantillas de mensajes

**Reminders & Messages → Message Templates** te permite cambiar la redacción de cada recordatorio, ver una vista previa en vivo, y elegir el **idioma del recordatorio**.

- Mantén los marcadores como `{{name}}` y `{{date}}` tal como están escritos; Sarang los completa. Si escribes un marcador que ese mensaje no puede completar (un error de escritura como `{{nmae}}`) o llaves que no cierran, Sarang te avisa mientras escribes y no lo guardará.
- **La redacción se guarda para el idioma de recordatorio que elegiste.** Elige Hindi arriba y escribe tu redacción en hindi; elige inglés y escribe tu redacción en inglés. La redacción guardada mientras está elegido el inglés también se aplica a cualquier idioma en el que no hayas escrito la tuya propia. **Reset** elimina la redacción vigente en este momento y trae de vuelta el texto integrado.
- **Los recordatorios ya pendientes se actualizan** cuando guardas una plantilla, cambias el idioma del recordatorio o cambias la firma: Sarang los reescribe para que coincidan, y te dice cuántos actualizó. Un recordatorio que editaste a mano, o uno que ya no encaja con su plantilla, se deja como está.
- **Firma.** Los mensajes integrados terminan con "Powered by Sarang | www.aszurex.com". Desmarca **End messages with Powered by Sarang** en la parte superior de la pantalla para quitarlo de todos los mensajes.
- Cada recordatorio empieza con el nombre de tu negocio en negrita, agregado automáticamente.

## Alertas que fijas tú mismo

**Settings → Business Features → Alert rules** te envía una notificación en la campana cuando se guarda una venta, una factura de proveedor o un gasto de al menos un importe que elijas (por ejemplo "Invoice saved, at least 50,000"). Puedes desactivar o eliminar una regla. Las reglas solo te avisan; nunca detienen ni cambian un documento, y se disparan para documentos hechos en las pantallas principales.

## Buenos hábitos

- Revisa **WhatsApp Reminders** una vez en la mañana y una vez en la tarde.
- Mantén los números de teléfono en formato internacional o local de forma consistente; Sarang agrega el código de tu país a los números locales (conoce los códigos de marcado de unos 100 países). Si tu país no es reconocido, escribe los números con el código de país y un signo más.
- Pregúntale a Sarang: "¿Cuántos recordatorios están pendientes?" te dice cuántos están listos, cuántos están programados para después y cuántos fallaron.
