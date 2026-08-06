# Centro de Servicio Automotriz

## Qué incluye

Centro de Servicio Automotriz está construido sobre la base compartida de negocio de servicio de Sarang — citas, un catálogo de servicios, horarios de proveedores, y la cola de notificaciones — más un único módulo dedicado: **Órdenes de Trabajo**.

## Órdenes de Trabajo

Cada orden de trabajo registra al cliente y el vehículo — número de vehículo, marca, modelo, año, tipo de vehículo (2R, 4R, Comercial, Otro), lectura de odómetro de entrada (y salida, una vez que el vehículo es devuelto), el asesor de servicio, y uno o más técnicos asignados.

Una orden de trabajo lleva dos listas de líneas:

- **Service items** — cargos de mano de obra: un nombre, cantidad, y tarifa, totalizados como el total de mano de obra.
- **Parts** — ya sea escritos en texto libre (una pieza obtenida puntualmente, no rastreada contra el stock), o agregados **buscando en su inventario real**, lo cual vincula la línea a un Product real. Una pieza vinculada es lo que hace que la facturación realmente la descuente del stock cuando se factura la orden de trabajo; una pieza de texto libre nunca toca el inventario.

Una orden de trabajo avanza a través de un embudo de estado: **Received → Inspection → In Progress → (Waiting Parts, si es necesario) → Ready → Delivered**, con Cancelled como resultado separado. Una vez en Ready, un botón de **Generar Factura** factura la mano de obra y las piezas juntas como una factura real.

Configure una fecha de **próximo servicio debido** y/o una lectura de odómetro en una orden de trabajo, y haga clic en **Remind** para programar un recordatorio real de WhatsApp al cliente antes de esa fecha. Abra la pestaña de **Vehicles** para ver cada vehículo distinto que ha atendido, agrupado por número de matrícula con una insignia de Due Soon/Overdue — haga clic en **History** en cualquier vehículo para su historial de servicio completo agrupado, del más reciente al más antiguo.

La barra de KPI muestra trabajos activos, trabajos listos para recoger, y trabajos entregados este mes.

## Idioma

Centro de Servicio Automotriz es una de las 24 plantillas de negocio de servicio dedicadas de Sarang, y como casi todas ellas su interfaz es **solo en inglés**, sin importar el idioma que haya configurado en el resto de Sarang.
