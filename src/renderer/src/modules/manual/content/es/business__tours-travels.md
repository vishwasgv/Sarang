# Turismo y Viajes

## Qué es diferente en este tipo de negocio

Turismo y Viajes cubre el alquiler de taxis/vans/autobuses chárter, paquetes turísticos con asientos compartidos, y todo lo que conlleva operar una pequeña flota de vehículos: liquidación de turnos de conductores (bata, pernocte, asignación por conducción nocturna, y facturación de exceso de km/hora), seguimiento de servicio/mantenimiento de vehículos, y comisión de agentes referidores. La investigación de mercado real confirma que las tarifas de taxis interurbanos se cotizan por km según la clase de vehículo con un mínimo de km diario — una **tarifa de paquete**, no un taxímetro en vivo — así que cada reserva aquí captura una tarifa de paquete por adelantado, con los cargos por exceso liquidados solo una vez que se cierra el registro de turno de un viaje.

## Flota de Vehículos

Abra **Flota de Vehículos** en la barra lateral para registrar cada vehículo (número de matrícula, tipo, capacidad de asientos) y hacer seguimiento de su odómetro. La misma pantalla muestra el **Calendario de Disponibilidad de Flota y Asientos** — el estado de reserva/libre de cada vehículo y los asientos restantes de cada próxima salida de tour, para los próximos 30 días — y le permite registrar visitas de **Servicio / Reparación / Mantenimiento** con costo y lectura del odómetro, construyendo el historial que lee el informe de Vencimiento de Servicio del Vehículo.

## Paquetes Turísticos y Reserva de Asientos

Abra **Paquetes Turísticos** para definir un paquete reutilizable (nombre, itinerario, duración, asientos predeterminados, tarifa por asiento), luego programe **salidas** reales contra él en fechas específicas. Un cliente reserva **asientos** individuales en una salida — el conteo de asientos se reclama atómicamente para que dos empleados nunca puedan sobrevender la misma salida — y la tarifa del paquete se calcula automáticamente como asientos × tarifa por asiento.

## Reservas de Viaje y Turno de Conductor

Abra **Reservas de Viaje** para crear una reserva chárter exclusiva: elija el cliente y el vehículo, establezca las fechas del viaje, recogida/entrega/ruta, una tarifa de paquete, y los **km/día incluidos** y **horas/día incluidas** que cubre el paquete. Capture un anticipo si se cobró uno, y opcionalmente el nombre de un agente referidor y su comisión.

Una vez que el viaje está en curso, use **Start Duty** contra la reserva: asigne un conductor, registre el odómetro y hora de inicio, y la bata (asignación diaria) del conductor, el cargo por pernocte, y la asignación por conducción nocturna si aplica. Cuando el viaje termina, use **Close Duty** con el odómetro y hora finales — Sarang calcula los km recorridos y las horas en turno, y si alguno excede la asignación incluida del paquete, el exceso se cobra a una tarifa por km que varía según la clase de vehículo (sedán/SUV/van/minibús/autobús) más una tarifa fija de exceso de hora. Este cargo por exceso es ingreso de cara al cliente; la bata/pernocte/conducción nocturna del conductor sigue siendo un costo separado, nunca facturado como margen.

Una vez que una reserva está lista para facturar, use **Generate Invoice** — factura la tarifa del paquete más cualquier cargo por exceso de km/hora liquidado de registros de turno cerrados, y registra el anticipo ya cobrado como un pago real contra la nueva factura.

## Informes

Junto con los informes estándar de Ventas, Inventario y Financieros, Turismo y Viajes obtiene:

- **Vencimiento de Servicio del Vehículo** — km totales recorridos por vehículo desde su último servicio, con vehículos vencidos o próximos a vencer marcados contra su propio km de próximo servicio registrado o un intervalo predeterminado genérico.
- **Comisión por Agente** — comisión de referido ganada por agente, sumada en cada reserva de viaje en el rango seleccionado.
- **Rentabilidad de Viaje** (función destacada) — por cada viaje completado: ingresos (tarifa de paquete más cargos por exceso) menos costo del conductor, un costo de combustible estimado a partir de los km recorridos, una parte prorrateada del costo de mantenimiento del vehículo, y comisión — el único número que muestra el margen real por viaje, no solo el ingreso.

## Idioma

Turismo y Viajes no es una de las plantillas de negocio de servicios de Sarang — es un tipo de negocio por categoría de producto/flota, así que **no** está bloqueada por idioma. La interfaz principal, incluyendo Flota de Vehículos, Paquetes Turísticos, y Reservas de Viaje, está disponible en los 13 idiomas compatibles.
