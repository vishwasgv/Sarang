# Insumos y Equipos Agrícolas

## Qué es diferente en este tipo de negocio

Insumos y Equipos Agrícolas cubre tiendas que venden tanto insumos agrícolas consumibles (fertilizantes, pesticidas, semillas) como equipos agrícolas duraderos (tractores, pulverizadores, bombas) uno junto al otro. En lugar de inventar una nueva pantalla para esto, Sarang le da exactamente el seguimiento que cada mitad del negocio realmente necesita, tomado de los dos rubros que ya resuelven correctamente cada mitad: seguimiento de lotes y caducidad (la misma estructura crítica para la seguridad que usa Farmacia para medicamentos) para los consumibles, y seguimiento de número de serie y garantía (la misma estructura que usa Electrónica para teléfonos) para el equipo — menos el IMEI, que es específico de teléfonos y no tiene equivalente en un tractor o pulverizador.

## Fertilizantes y Pesticidas — seguimiento de lotes y caducidad

Cada producto de fertilizante, pesticida o semilla que ingresa como lote recibe un número de lote, fecha de fabricación y fecha de caducidad, exactamente como una farmacia que ingresa medicamentos. Abra **Batch Tracking** en la barra lateral para registrar los lotes entrantes y ver qué se acerca a su vencimiento. Esto importa por la misma razón que importa en una farmacia: los agroquímicos genuinamente se degradan y pueden volverse inseguros o ineficaces después de su fecha de caducidad, y un comerciante necesita poder responder "cuál de mi stock vence antes" de un vistazo, en lugar de adivinar de memoria.

## Equipo Agrícola — números de serie y garantía

Los tractores, pulverizadores motorizados, bombas de agua y otros equipos duraderos se rastrean individualmente por número de serie en lugar de como una cantidad indiferenciada, con un período de garantía registrado contra cada unidad. Abra **Serial Tracking** en la barra lateral para esto. A diferencia de Electrónica (que también rastrea el IMEI para teléfonos móviles), Insumos Agrícolas deliberadamente no activa el seguimiento de IMEI — es un identificador específico de teléfonos que no tiene significado para un tractor o pulverizador, así que ese campo simplemente no aplica aquí.

## Servicio de Equipos — Órdenes de Trabajo

Cuando un cliente trae un equipo para reparación o mantenimiento programado, abra una orden de trabajo desde **Job Cards** en la barra lateral — el mismo flujo de trabajo genérico de órdenes de trabajo que usa el tipo de negocio Reparación de Sarang. Registre qué se trajo, el trabajo a realizar, los repuestos usados y los cargos de mano de obra, y la orden de trabajo se puede facturar una vez que el trabajo esté completo.

## Condiciones de crédito ligadas a la cosecha

Un cliente agricultor a menudo necesita pagar después de la cosecha, no en el momento de la compra. Al facturar una venta a Crédito, establezca una **fecha de vencimiento** real — Sarang muestra una insignia de vencido en la factura una vez que pasa esa fecha (no la fecha de venta), y el informe de antigüedad de Análisis de Pendientes también la agrupa según la fecha de vencimiento real, de modo que un pago diferido hasta la cosecha no se marque como vencido solo porque ha pasado tiempo desde la venta.

## Alertas de caducidad específicas por categoría

Las distintas categorías de insumos agrícolas necesitan diferentes plazos de aviso previo — las semillas y los fertilizantes a menudo necesitan más anticipación que un artículo de rotación rápida. Configure un **plazo de alerta de caducidad** (en días) por producto para anular la ventana de aviso estándar de 30 días; los lotes de ese producto mostrarán entonces su insignia de aviso según el plazo configurado específicamente para él.

## Panel combinado

Abra **Agri Dashboard** para una vista en una sola pantalla de ambas mitades del negocio a la vez — consumibles con poco stock, lotes por vencer/vencidos, cantidad total de equipos y equipos con garantías por vencer pronto — en lugar de revisar dos pantallas separadas.

## Logística y Cadena de Suministro

Debido a que los distribuidores de insumos agrícolas reciben rutinariamente entregas formales de proveedores (sacos de fertilizante y equipo llegando por camión), el conjunto completo de módulos de Logística y Cadena de Suministro está activado por defecto — Flota, Transportistas, Envíos, GRN (recepción de mercancía), Albarán de Entrega, Libro de Fletes y Análisis de Logística aparecen todos en la barra lateral sin necesidad de activarlos por separado.

## Todo lo demás

Facturación, Clientes y Proveedores, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos — nada de este tipo de negocio cambia cómo factura una venta o recibe un pago.

## Idioma

Insumos y Equipos Agrícolas no es uno de los rubros de servicio profesional de Sarang, así que no tiene bloqueo de idioma — la interfaz completa está disponible en los 13 idiomas admitidos por Sarang, igual que Minorista, Farmacia, o cualquier otro tipo de negocio por categoría de producto.
