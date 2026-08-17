# Panel

## Lo que ve al iniciar sesión

El **Panel** es la pantalla de inicio de Sarang. En la parte superior están el nombre de su negocio, la fecha de hoy, y un botón de **Actualizar** que fuerza una lectura fresca de cada número en la página (de lo contrario, los números se almacenan brevemente en caché por velocidad).

Si **Ask Sarang** (el AI Assistant) se ha activado en **Configuración → Funciones Adicionales de Negocio**, un cuadro de consulta rápida aparece justo debajo del encabezado — escriba una pregunta en lenguaje simple sobre sus ventas, stock, clientes o ganancias, y se abre la pantalla de **Ask Sarang** con la respuesta.

Los negocios nuevos ven aquí una breve lista de verificación de **Primeros Pasos** (agregar su primer producto, agregar un cliente, crear su primera factura) hasta que las tres estén hechas o usted la descarte.

## Alertas

Encima de las tarjetas de KPI, Sarang muestra una pequeña cantidad de alertas accionables cuando aplican a usted, cada una coloreada como advertencia (amarillo) o peligro (rojo) según la gravedad:

- **Stock bajo** — uno o más productos en o por debajo de su nivel de reabastecimiento.
- **Sin copia de seguridad / copia de seguridad atrasada** — nunca se ha hecho una copia de seguridad, o ha pasado más tiempo que su intervalo de recordatorio desde la última.
- **Saldo pendiente elevado** — el total pendiente de clientes ha cruzado un umbral.
- **Recordatorios pendientes** — recordatorios de servicio/citas en cola pero aún no enviados (con un enlace de un clic para revisarlos).
- **Falla del registro de auditoría** — una acción reciente no pudo escribirse en el registro de auditoría, vale la pena verificar el espacio en disco/permisos.
- **Alquiler atrasado** — uno o más artículos alquilados están atrasados para su devolución (negocios de Alquiler).

## Tarjetas de KPI

La cuadrícula principal de tarjetas cubre: **Ventas de Hoy**, **Ventas de Esta Semana**, **Ventas de Este Mes** (cada una con un porcentaje de tendencia frente al período anterior), **Saldo Pendiente**, **Inventario** (valor de stock), **Gastos Totales** de este mes, **Estimación de Ganancia** de este mes, **Artículos con Stock Bajo** (un conteo), **Clientes** (un conteo) y **Proveedores** (un conteo). Las tarjetas de ingresos, valor de inventario, gastos y ganancia están ocultas según su nivel de permiso — si no tiene el permiso de análisis correspondiente, la tarjeta muestra "—" en lugar de un número, en vez de ser eliminada por completo.

Los negocios de tipo Restaurante con KOT activado también ven dos tarjetas adicionales encima de la cuadrícula para los KOT pendientes y los KOT en proceso, cada una enlazando directamente a la pantalla de pedidos de cocina.

## Gráficos y desgloses

Debajo de las tarjetas: un gráfico de tendencia de ingresos frente a gastos que puede alternar entre Hoy/Semana/Mes/Trimestre/Año o un rango de fechas personalizado, y un gráfico de barras de Productos Principales. Debajo de eso, un desglose de Saldo Pendiente (sus principales clientes por monto adeudado) se ubica junto a una barra de Salud del Inventario que muestra la división entre productos activos, con stock bajo y agotados.

## Actividad Reciente y Acciones Rápidas

El panel inferior izquierdo lista sus acciones registradas más recientes en todo el sistema (quién hizo qué, y cuándo). El panel inferior derecho tiene atajos de un clic a las acciones que más usan los propietarios: Nueva Factura, Agregar Producto, Agregar Cliente, Informes, Inventario y Copia de Seguridad.

## Destacado de la Industria

Una pequeña tarjeta debajo de Acciones Rápidas se adapta a su tipo de negocio, mostrando de dos a cuatro números que ese rubro realmente consulta cada día — no un conjunto genérico de indicadores. Ahora cada tipo de negocio tiene su propia tarjeta real; ninguno recurre a una vista tipo Minorista por defecto. Algunos ejemplos:

- **Gimnasio/Estudio** — membresías que vencen esta semana y este mes, y su número de membresías activas, con enlace directo a la pantalla de Membresías.
- **Abogado** — casos abiertos y audiencias programadas en los próximos 7 días.
- **Estudio Fotográfico** — próximas sesiones, sesiones programadas este mes, y entregas pendientes de edición.
- **Autoescuela** — alumnos con examen en los próximos 14 días, y cuántos tienen pocas sesiones restantes en su paquete.
- **Clínica Médica/Dental/Fisioterapia/Veterinaria, Salón de Belleza, Gestión de Eventos, Sastrería/Boutique, Control de Plagas** — citas de este mes, tasa de finalización, e inasistencias/cancelaciones.
- **Servicio, Consultor, Arquitecto, Ingeniero Civil, Agencia de Marketing, Agencia de Software, Bienes Raíces** — proyectos activos, completados este mes, y valor total de contratos.
- **Hotel/Alojamiento** — habitaciones ocupadas, tasa de ocupación, y habitaciones disponibles.
- **Laboratorio de Diagnóstico** — órdenes de análisis este mes, pendientes, y entregados.
- **Instituto de Formación** — cuotas pendientes, alumnos con cuotas pendientes, e importe recibido este mes.
- **Despacho Contable / Secretaría Corporativa** — tareas de cumplimiento abiertas, cuántas están vencidas, y cuántas vencen esta semana.
- **Taller / Centro de Servicio Automotriz** — órdenes de trabajo este mes, pendientes, y entregadas.
- **Agencia de Colocación** — candidatos activos, órdenes de trabajo abiertas, y colocaciones este mes.
- **Restaurante, Joyería, Ferretería/Vidrio/Madera, Distribuidor/Mayorista** — mantienen sus tarjetas ya existentes (ingresos de hoy y ocupación de mesas; tarifas de metal; saldo pendiente de clientes y valor de inventario; deudas pendientes y número de proveedores).
- **Un negocio general sin una coincidencia más cercana** — número de facturas de hoy y saldo total pendiente: aun así, números reales de sus propios datos, no un marcador de posición.

El primer elemento de cada tarjeta enlaza directamente a la pantalla que resume.
