# Mensajería y Recordatorios de WhatsApp

Sarang puede preparar mensajes de WhatsApp para sus clientes — recordatorios de citas, avisos de pago vencido, renovaciones de membresía/contrato, y mucho más, en todo tipo de negocio — y entregarlos listos para enviar a WhatsApp. Sarang nunca envía un mensaje automáticamente: siempre abre su propio WhatsApp (Escritorio o Web) con el mensaje pre-rellenado, y usted mismo hace clic en **Send**. Este es el mismo enfoque de "usted siempre tiene el control" que usan los botones Share via WhatsApp en Facturas y otros documentos (vea **Facturación y Documentos**).

Hay tres lugares relacionados donde esto aparece, cubiertos a continuación: la cola de **WhatsApp Reminders**, el editor de **Message Templates**, y el envío de un mensaje puntual desde la propia página de un **Cliente**.

## WhatsApp Reminders — enviar lo que Sarang ya preparó

Abra **WhatsApp Reminders** desde la barra lateral. A medida que usa Sarang día a día — reservando citas, una factura que vence, una membresía por expirar — la aplicación prepara automáticamente mensajes de recordatorio y los agrega aquí con estado **Pending**. Aún no se ha enviado nada; esta lista es simplemente todo lo que está listo para salir.

Para cada recordatorio pendiente puede:
- Hacer clic en **Send on WhatsApp** — abre WhatsApp con el mensaje y el número de teléfono del cliente pre-rellenados. Usted lo revisa y hace clic en Send dentro de WhatsApp.
- Hacer clic en la marca de verificación para **Mark Sent** una vez que realmente lo haya enviado, para que salga de su lista de pendientes.
- Hacer clic en la X para **Dismiss** un recordatorio que no desea enviar (por ejemplo, ya llamó al cliente en su lugar).

Use el filtro **Pending / Sent / All** en la parte superior para revisar el historial. Un recordatorio solo aparece aquí si el cliente tiene un número de teléfono registrado — Sarang no puede preparar un mensaje de WhatsApp sin uno.

## Message Templates — personalizar lo que dicen sus recordatorios

Cada mensaje de recordatorio anterior proviene de una plantilla — una por situación (recordatorio de cita, pago vencido, expiración de membresía, etc.), cubriendo cada rubro de negocio que Sarang admite. Por defecto usan una redacción sensata ya escrita, pero puede personalizar cualquiera de ellas.

Abra **Settings → Message Templates**. Las plantillas están agrupadas por área de negocio (Gimnasio, Legal, Veterinaria, Logística, etc.) — haga clic en un grupo para expandirlo. Para cada plantilla verá:

- Su redacción actual, en un cuadro de texto editable.
- Los **placeholders** que admite debajo, mostrados como `{{customerName}}`, `{{date}}`, etc. — estos se sustituyen por los datos reales del cliente cuando realmente se genera un recordatorio. Manténgalos exactamente como se muestran (misma ortografía, mismas dobles llaves) si edita el texto circundante; un placeholder que elimine o escriba mal aparecerá literalmente en el mensaje enviado en lugar del valor real.
- Una insignia **Customized** una vez que guarde su propia redacción, y un botón **Reset to Default** para volver a la redacción de Sarang en cualquier momento.
- Una insignia **Internal note** en la única plantilla (recordatorios de generación de factura de retainer) que es una nota de tareas pendientes para su propio personal, no algo que se envíe nunca a un cliente.

Haga clic en **Preview** en cualquier plantilla para ver cómo se vería realmente, rellenada con datos de ejemplo realistas — una forma rápida de verificar que su redacción suena natural antes de guardar.

### Reminder Message Language

En la parte superior de la pantalla Message Templates, un **administrador/gerente** puede establecer el **Reminder Message Language** — el idioma que usará cualquier plantilla que no se haya personalizado individualmente al generarse un recordatorio. Esto es independiente de su propio idioma de visualización personal (el que elige en Settings → Language): su propia pantalla puede estar en inglés mientras los recordatorios de WhatsApp de su negocio salen en hindi, o en cualquier otro idioma compatible, porque lo que importa es lo que entienden sus *clientes*, no lo que muestra la pantalla de un empleado en particular. Una plantilla que usted mismo haya personalizado siempre usa su propia redacción guardada, sin importar esta configuración.

## Enviar un mensaje puntual de WhatsApp desde la página de un Cliente

No todos los mensajes encajan en un recordatorio programado — a veces solo quiere enviarle algo a un cliente específico ahora mismo. Abra la página de cualquier cliente y haga clic en **Send WhatsApp Message** (solo se muestra si ese cliente tiene un número de teléfono registrado).

1. Elija una plantilla del menú desplegable — el mismo catálogo que Message Templates, limitado a las orientadas al cliente (la nota de uso interno no se ofrece aquí).
2. El nombre del propio cliente se rellena automáticamente donde la plantilla lo requiera. Complete lo que la plantilla necesite además (un monto, una fecha, un número de caso...) en los cuadros provistos.
3. Una vista previa en vivo se actualiza mientras escribe, mostrando exactamente lo que se enviará.
4. Haga clic en **WhatsApp** para abrirlo pre-rellenado, igual que en cualquier otro lugar — revise y envíe desde allí.

## Una nota sobre cómo se abre WhatsApp realmente

Abrir WhatsApp de esta manera inicia WhatsApp Desktop si está instalado, o WhatsApp Web en su navegador si no — exactamente igual que los botones Share via WhatsApp en Facturas y otros documentos. Sarang no tiene forma de confirmar que un mensaje realmente se entregó una vez que WhatsApp se abre — por eso los recordatorios permanecen en **Pending** hasta que usted mismo hace clic explícitamente en **Mark Sent**.
