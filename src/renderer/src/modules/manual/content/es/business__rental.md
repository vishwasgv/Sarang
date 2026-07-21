# Negocio de Alquiler

## Qué es diferente en este tipo de negocio

Negocio de Alquiler es deliberadamente genérico — está construido para cubrir cualquier alquiler de corto plazo con retiro y devolución, ya sean carpas y utensilios para una boda, ropa, autos o motos, una vivienda de estadía corta, joyería por un día, estaciones de juego, electrónica o muebles. Lo que todos estos comparten es el mismo ciclo de vida de reserva → retiro → devolución, facturado por una tarifa basada en tiempo en lugar de un precio de venta único. Esto es distinto del módulo de Propiedad de Bienes Raíces, que es para arrendamientos de largo plazo sin ningún ciclo de retiro/devolución.

## Seguimiento por UNIDAD vs. GRANEL

Cada producto alquilable se rastrea de una de dos maneras:

- **UNIT (Unidad)** — para activos individualmente distintos, como un auto específico, un vestido de novia en particular, o una consola de juegos numerada. Cada artículo físico obtiene su propia entrada en **Rental Units** con una etiqueta de unidad y notas de condición, y una reserva reclama una unidad específica para su rango de fechas.
- **BULK (Granel)** — para cantidad agrupada e intercambiable, como "50 sillas de plástico" o "20 platos de cena." No hay identidad por artículo, solo una cantidad total en propiedad y cuánto de ella ya está comprometido en reservas superpuestas.

## Establecer tarifas de alquiler

Un producto alquilable puede tener una tarifa para cualquier combinación de **HORA, DÍA, SEMANA, MES o AÑO** — configure las que apliquen cuando marque un producto como alquilable. Una reserva elige una base de tarifa por artículo; la duración se calcula en esa unidad y se redondea hacia arriba (una reserva de poco más de un día igual se factura como un día completo, nunca una fracción).

## El ciclo de vida de la reserva

Abra **Rental Bookings** en la barra lateral. Una reserva pasa por:

1. **Reserved (Reservado)** — creada para un cliente, un rango de fecha/hora y uno o más artículos, con un depósito de garantía opcional cobrado por adelantado.
2. **Checked Out (Entregado)** — el/los artículo(s) salen físicamente con el cliente. Para artículos UNIT, el estado de la unidad específica pasa a Alquilado.
3. **Returned (Devuelto)** — el/los artículo(s) regresan. Usted registra cualquier cargo por daño y cuánto del depósito de garantía se reembolsa (por defecto, el depósito menos cualquier cargo por daño). Si la devolución es tardía, se calcula automáticamente un recargo por retraso a partir de la propia tarifa de cada artículo, normalizada a una cifra por día, multiplicada por un multiplicador de recargo configurable (1.5× por defecto).

Una reserva en estado Reserved también se puede **Cancelar** (antes del retiro) o **Extender** a una fecha/hora de fin posterior (siempre que el artículo permanezca disponible durante el nuevo rango).

Una reserva puede incluir varios artículos a la vez — cada uno obtiene su propio **cargo por daño** en la devolución, de modo que la factura de una reserva con varios artículos detalle exactamente qué unidad se dañó en lugar de una sola línea de reparación global. Adjunte **fotos de condición** reales tanto en el retiro como en la devolución de cada artículo, dándole un registro documentado de antes/después si alguna vez surge una disputa.

## Mantenimiento y alquileres recurrentes

Establezca un **intervalo de servicio** en un artículo con seguimiento UNIT — ya sea un número de alquileres o un número de días — y Sarang lo enruta automáticamente al estado Maintenance (Mantenimiento) al devolverse una vez alcanzado el intervalo, bloqueándolo de volver a alquilarse hasta que lo marque como reparado. Abra **Rental Units** para ver qué artículos están pendientes y registrar un servicio completado.

Para un cliente que alquila lo mismo en un horario regular, establezca un **intervalo de recurrencia** en la reserva y use **Crear siguiente ciclo** una vez que termine el período actual para generar la siguiente reserva con un clic en lugar de volver a ingresar todo desde cero.

## La disponibilidad siempre es en vivo, nunca un decremento de stock

Sarang nunca decrementa una cantidad de stock cuando se retira un alquiler. En cambio, la disponibilidad — tanto para artículos UNIT como BULK — se calcula en vivo a partir de cada reserva actualmente Reservada o Entregada que se superponga con el rango de fechas solicitado. Esto importa porque una reserva tiene que bloquear la disponibilidad *antes* del retiro — dos clientes que intentan reservar la misma última carpa para fechas superpuestas no deben poder tener éxito ambos, algo que un modelo de "decrementar solo al retirar" pasaría por alto.

## Facturación

Generar una factura a partir de una reserva completada crea líneas de artículo para el cargo de cada artículo alquilado, más líneas separadas para cualquier recargo por retraso y cargo por daño. El depósito de garantía deliberadamente **no** forma parte de la factura — se rastrea únicamente como un monto cobrado/reembolsado en la propia reserva, ya que es una retención, no un ingreso.

## Informes

**Informes** incluye un informe de Estado de Alquiler (qué está actualmente entregado, y qué está atrasado) y un informe de Ingresos de Alquiler por producto, incluyendo un porcentaje de utilización para los activos rastreados por UNIDAD.

## Idioma

Negocio de Alquiler no es una de las plantillas de negocio de servicio de Sarang — es un tipo de negocio por categoría de producto, así que **no** tiene bloqueo de idioma. La interfaz completa está disponible en los 13 idiomas admitidos.
