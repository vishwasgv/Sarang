# Autoescuela

Autoescuela es una de las 24 plantillas de negocio de servicio específicas de Sarang. Como cada tipo de negocio de ese grupo, las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

Cada plantilla de negocio de servicio comparte la misma base: **Appointments** para reservar, un **Service Catalog**, **Provider Schedule** para los horarios laborales del personal, y una **Notification Queue** en segundo plano para recordatorios. Autoescuela agrega su propia pantalla dedicada — con cinco pestañas — para las partes de manejar una autoescuela que no encajan en una cita genérica: perfiles de alumnos, sesiones de manejo, vehículos, exámenes, y paquetes.

## Alumnos

Elija cualquier cliente existente de la lista de búsqueda a la izquierda para abrir su **perfil de alumno** a la derecha: clase de licencia (LMV, HMV, dos ruedas, o una combinación), una clase de vehículo preferida, número de solicitud de DL, número de licencia de aprendizaje y fecha de emisión, y número de licencia permanente y fecha de emisión una vez que la aprueban. Este es el registro de cumplimiento que una autoescuela necesita para seguir el progreso de un alumno desde el permiso de aprendizaje hasta la licencia completa.

## Sesiones de Manejo

Cada lección de manejo individual se programa con un alumno, un instructor, un vehículo activo, una fecha/hora, una duración, y un punto de recogida opcional. El estado de una sesión avanza a través de **Scheduled → Completed** (o **No Show**). Una vez completada, puede ya sea:

- ingresar una **tarifa de sesión** y generar una factura puntual solo para esa lección, o
- canjearla contra un **paquete** que el alumno ya compró (vea Paquetes abajo), en cuyo caso no hay factura separada — se marca "Via package" en su lugar.

La pestaña de Sessions filtra por Hoy, Todas, Programadas, o Completadas.

## Vehículos

La propia flota de vehículos de instrucción de la escuela: número de matrícula, marca/modelo, clase de vehículo (LMV, dos ruedas, HMV), un instructor asignado, y un estado (Activo, Mantenimiento, Retirado). Solo los vehículos marcados como Activos se pueden elegir al programar una nueva sesión.

Configure un **intervalo de servicio** en un vehículo — por número de sesiones o por distancia de odómetro — y Sarang lo marca como Due for Service una vez que se cruza cualquiera de los dos umbrales, con base en sesiones completadas reales y la lectura de odómetro que registra. Abra **Maintenance** en un vehículo para registrar un servicio completado (odómetro, tipo de servicio, costo) y ver su historial completo de servicio.

## Exámenes

Sigue las reservas de examen reales de un alumno — examen de licencia de aprendizaje o examen de manejo — con una fecha de examen, centro de examen, y un resultado: Pendiente, Aprobado, o Reprobado, con una fecha de reexamen opcional si no aprueba la primera vez. Registre qué **instructor** enseñó al alumno, y una tarjeta de resumen de **Pass Rate by Instructor** muestra el historial real de aprobados/reprobados de cada instructor.

## Paquetes

El patrón de facturación más común de una autoescuela es vender un paquete de N lecciones por adelantado en lugar de facturar lección por lección. **Packages** tiene dos partes:

- **Package Catalog** — defina el nombre de un paquete, el número total de sesiones, precio, y a qué clase de vehículo aplica.
- **Learner Enrollments** — inscriba a un alumno en un paquete, siga las sesiones usadas contra el total, y genere la factura del paquete una sola vez (un paquete se factura como un todo, no por sesión). Cada sesión programada contra esa inscripción se descuenta de su conteo restante automáticamente en lugar de necesitar su propia tarifa o factura.
