# Clínica Veterinaria

Las pantallas de este tipo de negocio están solo en inglés, sin importar el idioma que tenga configurado en el resto de Sarang.

## La base de servicio compartida

Cada tipo de negocio basado en servicios en Sarang — incluida Clínica Veterinaria — parte de los mismos cuatro bloques de construcción: **Appointments** (reservar y programar visitas), un **Service Catalog** (la lista de consultas, procedimientos y sus precios), **Provider Schedules** (qué veterinario está disponible cuándo), y una **Notification Queue** automática que se encarga de los recordatorios (como los recordatorios de vacunación de abajo) sin que usted tenga que enviarlos a mano. El resto de este capítulo cubre lo específico de una clínica veterinaria.

## Pacientes

Abra **Patients** en la barra lateral para ver a cada animal registrado en su clínica, no a los dueños humanos. Cada tarjeta de paciente muestra la especie (con un marcador de emoji para Perro/Gato/Ave/Conejo/Reptil/Otro), raza, género, peso, y una insignia de estado de vacunación (Al Día / Próxima / Atrasada / Sin Registros). Filtre por especie, busque por nombre de paciente o dueño, o cambie a la vista de **Archived** para pacientes que ya no están activos.

Haga clic en **Add Patient** para registrar uno nuevo — nombre, especie, raza, fecha de nacimiento, género, color/marcas, ID de microchip, un dueño vinculado opcional (buscado entre sus Clientes existentes, o dejado como paciente sin cita previa), y notas de texto libre para alergias o condiciones crónicas.

Un banner en la parte superior de la lista de Patients muestra las **Upcoming Vaccinations** que vencen en los próximos 30 días entre todos los pacientes, para que nada se pase por alto.

## Perfil del paciente

Al abrir un paciente accede a tres pestañas:

- **Overview** — los datos del paciente, la tarjeta del dueño vinculado, y un registro de **Weight History**. Agregue un nuevo pesaje en cualquier momento; una vez que haya dos o más entradas, un pequeño gráfico de tendencia traza el peso a lo largo del tiempo.
- **Vaccinations** — cada registro de vacunación (nombre de la vacuna, tipo, número de lote, fabricante, fecha de administración, próxima fecha de vencimiento, veterinario que la administró). Cada registro muestra una insignia de estado (Atrasada / Vence en Xd / Al día). Desde aquí puede **poner en cola un recordatorio de WhatsApp** para una próxima fecha de vencimiento (se omite automáticamente si el dueño no tiene número de teléfono registrado), o **imprimir un certificado de vacunación**.
- **Appointments** — el historial completo de visitas del paciente con su estado (Programada, Confirmada, En Curso, Completada, Cancelada, No Asistió).

Editar un paciente también le permite **archivarlo** (lo oculta de la lista activa sin borrar el historial) y restaurarlo más tarde.

## Certificados de vacunación

Imprimir un certificado de vacunación produce un documento formal de una página con el membrete de la clínica, los datos del paciente y la vacuna, y un descargo de responsabilidad de que es un documento de conveniencia generado por Sarang, no un registro veterinario validado — verifique siempre los datos antes de confiar en él clínicamente.

## Notas de consulta

Al reservar una cita, elija el **paciente (mascota)** específico al que corresponde. Una vez que ocurre la visita, abra **Clinical Notes** para registrar una consulta real — signos vitales, hallazgos y plan — la misma toma de notas estructurada que comparte cada vertical clínica de Sarang. La nota se rellena previamente con el nombre y edad propios de la mascota (no los del dueño), y muestra la especie, raza, sexo y dueño de la mascota justo al lado para un contexto rápido.

Los signos vitales se comparan con **rangos normales** que tienen en cuenta la especie del paciente — el rango normal de temperatura y pulso de un perro genuinamente difiere del de un gato o un humano, y Sarang evalúa cada lectura automáticamente contra el rango correcto.
