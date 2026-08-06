# Hotel / Alojamiento

## Qué es diferente en este tipo de negocio

Hotel/Alojamiento es deliberadamente su propia vertical en lugar de una extensión del modelo genérico de Negocio de Alquiler o del modelo estándar de cita de visita única que usa cada otro negocio de servicio en Sarang. Una estadía de hotel necesita tres cosas que ninguno de esos cubre: captura de identificación del huésped legalmente requerida en el check-in, facturación por noche a través de una estadía de varias noches, y cargos extra durante la estadía agregados a un folio corriente antes del checkout final. Así que Hotel/Alojamiento obtiene un módulo dedicado, **Reservas de hotel**, que cubre todo el ciclo de vida de la reserva de forma independiente.

## Lista de habitaciones

Abra **Habitaciones** en la barra lateral para mantener su lista de habitaciones — número de habitación, tipo de habitación, piso, ocupación máxima, y una tarifa base por noche. El estado de una habitación (Disponible, Ocupada, Limpieza, Mantenimiento, o Fuera de Servicio) principalmente cambia por sí solo a medida que las reservas avanzan a través del check-in y check-out; no puede cambiar manualmente el estado de una habitación que actualmente tiene un huésped dentro.

## Reservar una estadía

Abra **Reservas de hotel** para crear una nueva reserva — elija una habitación, fechas de entrada y salida, nombre del huésped y datos de contacto, número de huéspedes (limitado a la ocupación máxima de la habitación), un pago de anticipo opcional, y de dónde vino la reserva (**origen/canal de reserva** — Visita Espontánea, Teléfono, MakeMyTrip, Booking.com, o cualquier otro canal que escriba). Sarang verifica que la habitación esté genuinamente libre para ese rango de fechas exacto antes de confirmar — la misma verificación de disponibilidad en vivo usada en otras partes de Sarang, así dos miembros del personal nunca pueden reservar dos veces la misma habitación para fechas superpuestas. Las noches se facturan por fechas calendario, no por horas transcurridas — una estadía desde el check-in por la tarde hasta el check-out por la mañana del día siguiente siempre es una noche, como en la práctica hotelera normal.

Si el huésped se ha alojado antes, elegirlo de la búsqueda de clientes muestra su **conteo de estadías previas** justo en el formulario de New Booking, así el personal de recepción puede reconocer y dar la bienvenida a un huésped recurrente.

Para una estadía más corta del mismo día, elija **Day Use** en lugar de una reserva nocturna normal — se factura a la tarifa de uso diurno configurada de la habitación (o la mitad de la tarifa nocturna si no hay ninguna configurada) y aun así reserva la habitación por todo el día.

### Tarifas de temporada

Configure precios por rango de fechas bajo **Manage Seasonal Rates** en la pantalla de Rooms — una tarifa general para todas las habitaciones durante un período (p. ej. un recargo de temporada de festival), o una tarifa específica para un tipo de habitación. Una estadía que abarca un límite de temporada se cotiza correctamente noche por noche, no a una tarifa plana para toda la estadía.

### Reservas grupales

¿Reservando varias habitaciones para el mismo huésped para un grupo o familia? Marque las reservas relacionadas en la lista de Hotel Bookings y use **Generate Combined Bill** para producir una sola factura que las cubra todas, en lugar de una factura separada por habitación.

## Cumplimiento de identificación del huésped en el check-in

Registrar el check-in de una reserva requiere registrar al menos la identificación de un huésped — nombre, tipo de identificación (Aadhaar, Pasaporte, Licencia de Conducir, Identificación de Votante, o PAN en India; Pasaporte, Identificación Nacional, Licencia de Conducir, u Otra Identificación Gubernamental en otros lugares), número de identificación, y nacionalidad. Esto no es fricción adicional por sí misma — muchas jurisdicciones legalmente requieren que un establecimiento de alojamiento mantenga un registro exhibible de la identidad de cada huésped para verificación policial o de inmigración, y este es exactamente ese registro.

## Cargos extra durante la estadía

Mientras un huésped está registrado, agregue cargos extra a su estadía desde la pantalla de detalle de la reserva — servicio a la habitación, lavandería, minibar, cualquier cosa facturada además de la tarifa de habitación. Estos se acumulan en un folio corriente que se agrega a la factura final; los cargos solo se pueden agregar o quitar mientras el huésped todavía está registrado.

## Checkout y facturación

El checkout termina la estadía y libera la habitación para limpieza. Generar la factura factura el cargo de habitación (tarifa nocturna × noches) más cada cargo extra como su propia línea, así la factura impresa detalla la estadía de la manera en que lo haría un folio de hotel real. Cualquier pago de anticipo recolectado al momento de la reserva se registra automáticamente como un pago contra la nueva factura. Como cualquier otra factura en Sarang, se puede imprimir en A4 o en ancho de recibo térmico.

## Limpieza

Cada checkout pone en cola automáticamente una **tarea de limpieza** para esa habitación. Abra **Limpieza** para ver cada tarea pendiente, asignarla a un miembro del personal, y marcarla como hecha — una vez que cada tarea abierta para una habitación está completa, la habitación vuelve a Disponible por sí sola, en lugar de depender de que alguien recuerde cambiar su estado manualmente.

## Cancelación o no presentación

Una reserva Confirmed que todavía no ha hecho check-in se puede cancelar (con un motivo opcional) o marcar como no presentación. Una vez que un huésped ha hecho check-in, el único camino hacia adelante es el checkout — una reserva con check-in ya realizado ya no se puede cancelar, ya que el huésped está físicamente en la habitación.

## Informes

**Informes** incluye un informe de Occupancy (habitaciones ocupadas/disponibles/en limpieza/en mantenimiento en este momento, con un porcentaje de ocupación) y un informe de Guest Register — el registro de cumplimiento que esta vertical existe para respaldar, que lista los datos de identificación de cada huésped para estadías que se superponen con un rango de fechas que usted elige, listo para producir bajo demanda.

## Idioma

Hotel/Alojamiento es una de las plantillas de negocio de servicio de Sarang, y — a diferencia de Sastre/Boutique, la única excepción nombrada — mantiene la regla estándar para ese grupo: la interfaz está bloqueada a **solo inglés**, sin importar el idioma que haya configurado en el resto de Sarang.
