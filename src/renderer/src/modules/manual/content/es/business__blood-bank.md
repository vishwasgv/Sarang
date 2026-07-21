# Banco de Sangre

## Qué es diferente en este tipo de negocio

Un Banco de Sangre rastrea donantes, donaciones, tamizaje, stock y emisión — un flujo de trabajo sin un equivalente real en ninguna otra parte de Sarang. Deliberadamente **no** usa la pantalla genérica de Gestión de Lotes que usan Farmacia e Insumos Agrícolas, aun cuando cada unidad de sangre utilizable se convierte por debajo en un registro de lote. La pantalla genérica tiene una ventana fija de 30 días de "por vencer pronto" y ningún concepto de grupo sanguíneo — ambos incorrectos para la sangre, donde una unidad de plaquetas solo es utilizable por unos 5 días y una unidad de sangre entera por unos 35. Así que Banco de Sangre obtiene su propia pantalla dedicada de **Blood Stock** con reglas de caducidad construidas específicamente para la sangre, mientras sigue reutilizando el mismo libro de stock subyacente que usa todo lo demás.

## Registro de donantes

Abra **Donors** en la barra lateral para registrar un nuevo donante — nombre, teléfono, fecha de nacimiento, **género**, grupo sanguíneo y peso. Cada donante recibe un código de donante secuencial (p. ej. `DNR-202607-0001`). Un donante se puede marcar como **diferido** (temporal o indefinidamente no apto para donar, con un motivo), lo que bloquea registrar una nueva donación de él hasta que el período de diferimiento realmente haya pasado. Puede enviar un recordatorio de recuperación por WhatsApp a un donante una vez que vuelva a ser elegible — Sarang estima su próxima fecha de elegibilidad a partir del tipo de su última donación y su género (90 días para sangre entera/glóbulos rojos en el caso de un donante hombre, 120 para una donante mujer, 14 para plaquetas, 28 para plasma) como valor conservador por defecto; siempre siga su propia guía médica/regulatoria local para la ventana de elegibilidad real.

## Donaciones y campañas

Registre cada donación bajo **Donations & Screening** — donante, grupo sanguíneo, tipo de componente (Sangre Entera, Glóbulos Rojos Empacados, Plaquetas, Plasma o Crioprecipitado) y volumen. Opcionalmente puede organizar donaciones bajo una campaña de donación (nombre, ubicación, fecha, organizador) para campañas realizadas fuera de sus propias instalaciones.

## Tamizaje

Cada donación comienza con el tamizaje **Pendiente**. Solo un resultado **Aprobado** crea stock real y utilizable — es en ese momento que se crea un registro de lote con una fecha de caducidad calculada a partir de la vida útil real del tipo de componente (35 días para Sangre Entera, 42 para Glóbulos Rojos Empacados, 5 para Plaquetas, 365 para Plasma y Crioprecipitado). Un resultado **Rechazado** nunca entra al stock en absoluto. Este control es deliberado: una unidad no tamizada o rechazada nunca debe poder emitirse.

## Blood Stock

Abra **Blood Stock** para ver cada unidad disponible agrupada por grupo sanguíneo y tipo de componente, con días para vencer y una marca de "por vencer pronto" que usa una ventana de alerta específica por componente (tan poco como 2 días para plaquetas, hasta 30 para plasma) en lugar de un único umbral genérico.

## Emisión — con verificación de compatibilidad

Al emitir unidades a un receptor, Sarang verifica la compatibilidad ABO/Rh entre el grupo sanguíneo del receptor y el grupo del donante de cada unidad, usando reglas estándar para sangre entera / glóbulos rojos empacados (y la regla inversa para plasma, donde AB es el donante universal). Esta es una verificación de seguridad informativa mostrada en el momento de la selección — nunca sustituye el propio procedimiento real de prueba cruzada de su laboratorio. Las plaquetas y el crioprecipitado no tienen ninguna regla de compatibilidad estricta impuesta, coherente con la práctica común de los bancos de sangre para esos componentes. Emitir una unidad la marca permanentemente como usada y reduce el libro de stock; cancelar una emisión no facturada restaura las unidades.

## Facturación

Genere una factura a partir de una emisión de sangre una vez que cada unidad emitida tenga un precio establecido y la emisión esté vinculada a un cliente.

## Idioma

Banco de Sangre no es una de las plantillas de negocio de servicio de Sarang — es un tipo de negocio por categoría de producto, así que **no** tiene bloqueo de idioma. La interfaz completa está disponible en los 13 idiomas admitidos.
