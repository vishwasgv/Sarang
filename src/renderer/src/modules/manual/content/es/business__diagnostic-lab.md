# Laboratorio de Diagnóstico y Patología

## Qué es diferente en este tipo de negocio

Un Laboratorio de Diagnóstico y Patología funciona sobre la misma base de citas/catálogo de servicios que comparte cada negocio de servicio en Sarang, más un conjunto de pantallas específicas de laboratorio: **Órdenes de análisis de laboratorio**. Un catálogo de pruebas/paneles reutiliza el Service Catalog estándar en lugar de una lista paralela separada — un análisis de sangre o una radiografía es solo un servicio que vende, con precio y tasa de impuesto de la misma manera que cualquier otro servicio. Lo que es genuinamente diferente es el ciclo de vida de la orden por debajo — una orden de laboratorio avanza a través de la toma de muestra, la entrada de resultados por prueba, y un informe bloqueado y finalizado, antes de ser facturada o entregada al paciente.

## Crear una orden de laboratorio

Abra **Órdenes de análisis de laboratorio** en la barra lateral. Una nueva orden necesita un nombre de paciente (el registro de cliente vinculado es opcional — los pacientes sin cita previa están bien) y al menos una prueba o panel seleccionado de su Service Catalog. Puede opcionalmente registrar la edad del paciente y vincular la orden a una cita existente. Cada orden obtiene un número de orden secuencial (p. ej. `LAB-202607-0001`, reiniciado por mes calendario).

## Derivaciones desde una clínica

Si un médico en otro lugar derivó a este paciente a su laboratorio, registre quién lo derivó (`referredByProviderId`) junto con cualquier nota de derivación. Este es un flujo de trabajo real y cotidiano para un laboratorio independiente que recibe derivaciones de clínicas médicas generales, clínicas de especialista, y hospitales de los que no forma parte.

## Toma de muestra

Una vez que se extrae una muestra (sangre, orina, heces, hisopo, imagen, u otro tipo), marque la orden como **Muestra Recolectada**. Esto registra quién la recolectó y cuándo, y mueve cada elemento de prueba pendiente en la orden al estado Collected. Las pruebas solo se pueden agregar o quitar de una orden antes de este paso — una vez que se recolecta una muestra, el conjunto de pruebas de la orden queda fijo.

## Entrada de resultados

Para cada prueba en la orden, ingrese su resultado: un conjunto de parámetros con nombre (valor, unidad, rango de referencia, y una marca de Bajo / Normal / Alto / Anormal — o **Crítico**, cuando un valor cae en el rango de valor crítico configurado para esa prueba). Ingresar el primer resultado en una orden la mueve automáticamente de Sample Collected a In Process, así el personal de recepción puede ver de un vistazo que el trabajo realmente ha comenzado sin esperar a que todas las pruebas terminen.

Un resultado **Crítico** pone una insignia roja en la orden (y en el elemento específico) de inmediato, y la orden no se puede considerar atendida hasta que use **Record Doctor Notified** para registrar que realmente llamó al médico que hizo la derivación, con una nota — este es un registro genuino de que la escalación ocurrió, no solo que el número fue marcado.

## Tiempo de respuesta (TAT)

Si una prueba en su Service Catalog tiene un **Target TAT (hours)** configurado — edite la entrada de la prueba para agregarlo — cada orden para esa prueba rastrea automáticamente su tiempo de respuesta real: el momento en que un resultado queda listo se compara con la hora de recolección de la muestra, y la fila de resultado de la prueba muestra una insignia **On Time** o **Late** con las horas exactas, justo junto a su estado. Sin un objetivo no hay insignia — esto es opcional por prueba, no un requisito.

## Finalizar el informe

Una vez que cada prueba en la orden tiene un resultado ingresado, **Finalize Report** bloquea toda la orden — su estado se vuelve Reported y cada elemento se marca como Reported. Los resultados de un informe finalizado ya no se pueden editar; si genuinamente se necesita una corrección, esta tiene que ocurrir antes de la finalización. Después de que el informe se finaliza, márquelo como **Entregado** una vez que el paciente o la clínica que refirió realmente lo haya recibido. Adjunte archivos reales de escaneo/imagen a una orden desde su vista de detalle.

## Facturación

Genere una factura directamente desde una orden de laboratorio una vez que cada prueba tenga un precio mayor que cero y la orden esté vinculada a un registro de cliente. Cada prueba aparece como su propia línea en la factura, usando la misma tasa de impuesto (código SAC, si está configurado) que su entrada en el Service Catalog.

## Informes

La pantalla de **Informes** incluye un informe de Lab Test Throughput específico de esta vertical, que muestra las órdenes por etapa (ordenada, muestra recolectada, en proceso, informada) y el tiempo de respuesta desde la orden hasta el informe para cada una — útil para detectar dónde se están acumulando las muestras.

Tres informes más específicos del laboratorio están junto a él. **Per-Test TAT** desglosa el tiempo de respuesta por nombre de prueba en lugar de por orden — horas reales promedio contra el objetivo propio de cada prueba, y cuántos resultados llegaron a tiempo versus tarde, para que pueda ver qué pruebas específicas son las que no cumplen su SLA en lugar de solo que "algo" está lento. **Test Volume by Panel** grafica cuántas pruebas está realizando por panel/categoría a lo largo del tiempo — una línea por panel, mes a mes. **Referral Leaderboard** clasifica a los médicos que refieren más pruebas a su laboratorio, para que sepa de dónde viene realmente su volumen.

## Idioma

Laboratorio de Diagnóstico y Patología es una de las plantillas de negocio de servicio de Sarang, y — a diferencia de Sastre/Boutique, la única excepción nombrada — mantiene la regla estándar para ese grupo: la interfaz está bloqueada a **solo inglés**, sin importar el idioma que haya configurado en el resto de Sarang.
