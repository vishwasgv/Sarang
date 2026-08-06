# Gimnasio / Estudio de Fitness

Gimnasio / Estudio de Fitness es una de las 24 plantillas de negocio de servicio específicas de Sarang. Como cada tipo de negocio de ese grupo, las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

Cada plantilla de negocio de servicio comparte la misma base: **Citas** para reservar, un **Catálogo de servicios** de lo que ofrece y a qué precio, **Horario del proveedor** para definir el horario laboral de cada entrenador y generar franjas horarias reservables reales, y una **Notification Queue** en segundo plano que envía recordatorios de citas. Gimnasio/Estudio agrega cuatro cosas sobre esa base: paquetes de sesiones, membresías, clases por lote, y comisión del personal.

## Membresías

**Membresías** está construido alrededor de planes y registros de entrada, a través de varias pestañas:

- **All Memberships** — la membresía de cada socio con su estado (Activa, Congelada, Vencida, Cancelada), estado de pago (Pagado, Pendiente, Parcial), días restantes, y sesiones usadas. **Freeze** una membresía activa con un motivo (una pausa real, no solo un cambio de estado) — su fecha de fin genuinamente se mueve hacia adelante tantos días como haya estado congelada una vez que la **Reanudar**, así que un socio nunca pierde tiempo pagado. También cancele una membresía y genere su factura directamente desde esta lista.
- **Por Vencer** — cada membresía que vence dentro de una ventana que usted elige (7/14/30/60 días), así puede comunicarse para la renovación antes de que caduque en lugar de después.
- **Plans** — el catálogo de planes de membresía que vende: duración en días, precio, un número opcional de sesiones incluidas (déjelo en blanco para ilimitado), y una lista opcional de clases que cubre el plan.
- **Quick Check-In** — una pantalla rápida de búsqueda por nombre o teléfono para que la recepción registre la entrada de un socio activo sin navegar a ningún otro lugar. Abra **Attendance History** en cualquier membresía para ver su registro completo de entradas.

## Clases por Lote (Clases Grupales)

Para sesiones grupales guiadas por instructor — yoga, Zumba, spinning, y similares — **Clases grupales** le permite definir una clase con un instructor, un horario semanal (elija los días y una hora), una sala/ubicación, una capacidad, y una fecha de inicio/fin. Cada clase muestra una barra de capacidad en vivo (inscritos frente a máximo) y se pone roja una vez llena. Desde una clase puede:

- **Manage enrollment** — agregar o quitar socios, bloqueado una vez que la clase alcanza la capacidad.
- **Mark attendance** — elegir una fecha de sesión y marcar qué socios inscritos asistieron; la asistencia se guarda por fecha y se puede revisar más tarde.

## Paquetes de Sesiones

El mismo mecanismo de sesiones prepagadas usado en todas las verticales de servicio de Sarang: un cliente compra un paquete de sesiones por adelantado, y **Paquetes de sesiones** sigue cuántas quedan por cliente, marcando los paquetes que están por agotarse o vencidos. Asigne un **entrenador habitual** a un paquete y Sarang precarga a ese entrenador automáticamente en las futuras reservas del cliente — todavía puede elegir a otra persona para una sesión de sustituto puntual, esto es solo una opción predeterminada conveniente, nunca una obligación.

## Comisión del Personal

Cuando una cita completada y que genera ingresos tiene un entrenador asignado, Sarang puede calcular la comisión de ese entrenador automáticamente (un 10% predeterminado de los ingresos por servicio, con la tasa real de cada miembro del personal configurable en su registro de Employee). La pantalla de **Comisión** da un informe mensual por miembro del personal — ingresos, comisión, propinas, pagado frente a pendiente — más una lista de registros filtrable que puede marcar como pagada en bloque.
