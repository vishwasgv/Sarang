# Salón de Belleza

Salón de Belleza es una de las 24 plantillas de negocio de servicio específicas de Sarang. Como cada tipo de negocio de ese grupo, las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

Cada plantilla de negocio de servicio comparte la misma base: **Citas** para reservar, un **Catálogo de servicios** de lo que ofrece y a qué precio, **Horario del proveedor** para definir el horario laboral de cada miembro del personal y generar franjas horarias reservables reales, y una **Notification Queue** en segundo plano que envía recordatorios de citas. Salón de Belleza agrega tres cosas sobre esa base: paquetes de sesiones, comisión del personal, y reserva multi-servicio.

## Reserva Multi-Servicio

Rara vez una cita de salón es un solo servicio — un cliente puede recibir un corte, un color, y un secado en la misma visita. El formulario de reserva de Salón de Belleza le permite agregar varios servicios a una sola cita; Sarang suma sus precios y duraciones automáticamente y reserva una franja combinada en lugar de obligarlo a crear citas separadas. Las citas también pueden llevar una **asignación de silla** para que sepa a qué estación está reservado un cliente. Adjunte **fotos de antes/después** reales a una cita desde su botón de ícono de cámara.

Si ha configurado qué estilistas están calificados para qué servicios (desde el registro de Employee de un estilista — vea *Comisión del Personal* abajo), el selector de Provider del formulario de reserva se reduce automáticamente a solo los estilistas calificados una vez que se elige un servicio coincidente.

## Cobro con venta adicional al por menor

Completar una cita abre un **Checkout** real — el total del servicio está ahí automáticamente, y puede agregar productos reales de venta al por menor (champú, producto de peinado) con cantidad directamente en la misma factura, además de elegir el método de pago real recibido. Todo sale como una sola factura con las líneas de servicio y de venta al por menor, en lugar de dos transacciones separadas.

## Paquetes de Sesiones

Un cliente puede comprar un paquete de sesiones prepagadas por adelantado (p. ej. "paquete de spa capilar de 10 sesiones") en lugar de pagar por visita. **Paquetes de sesiones** lista los paquetes de cada cliente con cuántas sesiones quedan, marca los paquetes que están por agotarse (2 o menos restantes) o ya vencidos, y le permite buscar por cliente. Cuando una cita vinculada a un cliente con un paquete activo se marca como **Completado**, Sarang descuenta automáticamente una sesión de ese paquete en lugar de requerir una factura separada — la lista de citas marca estas como "Paid via pack" en lugar de mostrar una acción de factura.

## Comisión del Personal

Cuando una cita completada tiene un proveedor y un monto, Sarang puede calcular la comisión de ese miembro del personal automáticamente (un 10% predeterminado de los ingresos por servicio, aunque la tasa real de cada miembro del personal es configurable en su registro de Employee). La pantalla de **Comisión** le da un informe mensual por miembro del personal — ingresos generados, comisión ganada, propinas, y cuánto está pagado frente a lo que sigue pendiente — más una lista completa registro por registro que puede filtrar por personal o estado de pago y marcar como pagado en bloque una vez que se liquidan los pagos.

Desde el formulario de edición de un empleado, marque qué servicios está **calificado** para realizar — deje un servicio sin estilistas calificados configurados y cualquier proveedor todavía puede ser reservado para él, así que esto es completamente opcional y no cambia nada a menos que lo configure.
