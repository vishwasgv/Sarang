# Control de Plagas

## Qué incluye

Control de Plagas está construido sobre la base compartida de negocio de servicio de Sarang — citas, un catálogo de servicios, horarios de proveedores, y la cola de notificaciones — más un único módulo dedicado: **Pest Control**, que cubre tanto contratos de servicio recurrentes como hojas de trabajo individuales.

## Contratos de Servicio

Un contrato registra al cliente, dirección y tipo de propiedad (Residencial, Comercial, Industrial), los tipos de plaga cubiertos (Cucarachas, Roedores, Termitas, Hormigas, Mosquitos, Chinches, Otro — elija tantos como apliquen), la frecuencia de servicio (Mensual, Trimestral, Semestral, Anual, Puntual), un valor de contrato, fechas de inicio/fin, y estado (Activo, Pendiente, Vencido, Cancelado).

Un contrato activo con un valor se puede facturar por su cuota recurrente con **Generar Factura** — esto no es una acción única: Sarang sigue para qué período se facturó el contrato por última vez, así puede facturar el mismo contrato de nuevo cada período que se repite, al ritmo que coincida con su propia frecuencia. Las facturas de contrato usan SAC 998534 al 18% de GST.

## Hojas de Trabajo

Una hoja de trabajo es una sola visita — opcionalmente vinculada a un contrato, o creada como una visita puntual/ad hoc — que registra la fecha/hora de la visita, técnicos asignados, pesticida usado, áreas atendidas (una lista de selección rápida: Cocina, Baños, Dormitorio, Depósito, Terraza, Jardín, Sótano, Oficina, Almacén, Cocina de Restaurante, Áreas Comunes), tipo de tratamiento (Aspersión, Gel, Fumigación, Trampa, Cebo, Combinado), monto del trabajo, y si se obtuvo la firma del cliente. Una hoja de trabajo avanza a través de **Scheduled → In Progress → Completed** (con Cancelled como resultado separado); una vez Completed, **Generar Factura** factura esa visita (mismo SAC 998534, 18% de GST).

Para un registro real y detallado de qué químicos se usaron realmente en una visita, agregue filas a **Pesticides Used** — nombre, cantidad, unidad, plaga objetivo, y una nota de dosificación opcional. Vincule una fila a un producto de inventario real para que descuente stock automáticamente cuando se use, o déjela sin vincular para un negocio que no rastrea el stock de químicos en Sarang.

La barra de KPI muestra contratos activos, hojas de trabajo pendientes, y hojas de trabajo programadas esta semana.

## Idioma

Control de Plagas es una de las 24 plantillas de negocio de servicio dedicadas de Sarang, y como casi todas ellas su interfaz es **solo en inglés**, sin importar el idioma que haya configurado en el resto de Sarang.
