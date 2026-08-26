# Insumos y Equipos Agrícolas

## Qué es diferente en este tipo de negocio

Insumos y Equipos Agrícolas cubre tiendas que venden tanto insumos agrícolas consumibles (fertilizantes, pesticidas, semillas) como equipos agrícolas duraderos (tractores, pulverizadores, bombas) uno junto al otro. En lugar de inventar una nueva pantalla para esto, Sarang le da exactamente el seguimiento que cada mitad del negocio realmente necesita, tomado de los dos rubros que ya resuelven correctamente cada mitad: seguimiento de lotes y caducidad (la misma estructura crítica para la seguridad que usa Farmacia para medicamentos) para los consumibles, y seguimiento de número de serie y garantía (la misma estructura que usa Electrónica para teléfonos) para el equipo — menos el IMEI, que es específico de teléfonos y no tiene equivalente en un tractor o pulverizador.

## Fertilizantes y Pesticidas — seguimiento de lotes y caducidad

Cada producto de fertilizante, pesticida o semilla que ingresa como lote recibe un número de lote, fecha de fabricación y fecha de caducidad, exactamente como una farmacia que ingresa medicamentos. Abra **Batch Tracking** en la barra lateral para registrar los lotes entrantes y ver qué se acerca a su vencimiento. Esto importa por la misma razón que importa en una farmacia: los agroquímicos genuinamente se degradan y pueden volverse inseguros o ineficaces después de su fecha de caducidad, y un comerciante necesita poder responder "cuál de mi stock vence antes" de un vistazo, en lugar de adivinar de memoria.

## Equipo Agrícola — números de serie y garantía

Los tractores, pulverizadores motorizados, bombas de agua y otros equipos duraderos se rastrean individualmente por número de serie en lugar de como una cantidad indiferenciada, con un período de garantía registrado contra cada unidad. Abra **Seguimiento de Números de Serie** en la barra lateral para esto. A diferencia de Electrónica (que también rastrea el IMEI para teléfonos móviles), Insumos Agrícolas deliberadamente no activa el seguimiento de IMEI — es un identificador específico de teléfonos que no tiene significado para un tractor o pulverizador, así que ese campo simplemente no aplica aquí.

## Servicio de Equipos — Órdenes de Trabajo

Cuando un cliente trae un equipo para reparación o mantenimiento programado, abra una orden de trabajo desde **Órdenes de Trabajo** en la barra lateral — el mismo flujo de trabajo genérico de órdenes de trabajo que usa el tipo de negocio Reparación de Sarang. Registre qué se trajo, el trabajo a realizar, los repuestos usados y los cargos de mano de obra, y la orden de trabajo se puede facturar una vez que el trabajo esté completo.

## Condiciones de crédito ligadas a la cosecha

Un cliente agricultor a menudo necesita pagar después de la cosecha, no en el momento de la compra. Al facturar una venta a Crédito, establezca una **fecha de vencimiento** real — Sarang muestra una insignia de vencido en la factura una vez que pasa esa fecha (no la fecha de venta), y el informe de antigüedad de Análisis de Pendientes también la agrupa según la fecha de vencimiento real, de modo que un pago diferido hasta la cosecha no se marque como vencido solo porque ha pasado tiempo desde la venta.

Escribir una fecha fija es solo una suposición — los términos de crédito reales de un agricultor siguen el calendario de cosecha, no un conteo fijo de días. En una venta a Crédito, en lugar de (o junto con) la fecha de vencimiento manual, puede vincular la factura a una **Temporada de Cultivo (Crop Season)** — un evento de cosecha real que define una vez (p. ej. "Cosecha de Trigo" el 15 de abril) y reutiliza en cada venta a crédito de ese cultivo. Selecciónela en el menú desplegable que aparece debajo del campo de fecha de vencimiento, o agregue una nueva allí mismo con **Manage Seasons**. Sarang calcula la fecha de vencimiento real de la factura a partir de la próxima ocurrencia de cosecha de esa temporada — la de este año si aún no ha pasado, o la del próximo año en caso contrario — de modo que la fecha de vencimiento siempre esté ligada a un evento agrícola real, no a un conteo de días arbitrario.

## Asesoría de Productos Vinculada al Cultivo

Si etiqueta un producto con el cultivo para el que está destinado mediante el campo Recommended Crop de su registro de producto (p. ej. "Trigo", "Algodón", "Arroz" — cualquier nombre que use su propia región, no una lista fija), ese producto se vuelve navegable por cultivo en el punto de venta. En Facturación, aparece una fila de chips **Browse by Crop** encima de la búsqueda de productos en cuanto se etiqueta algún producto — toque un cultivo para ver cada fertilizante, pesticida o semilla recomendados para él, con existencias y precio en vivo, y agréguelo directamente al carrito. Esto convierte "¿qué fertilizante va con este cultivo?" de algo que el cajero debe recordar en algo que puede buscar en dos toques.

## Alertas de caducidad específicas por categoría

Las distintas categorías de insumos agrícolas necesitan diferentes plazos de aviso previo — las semillas y los fertilizantes a menudo necesitan más anticipación que un artículo de rotación rápida. Configure un **plazo de alerta de caducidad** (en días) por producto para anular la ventana de aviso estándar de 30 días; los lotes de ese producto mostrarán entonces su insignia de aviso según el plazo configurado específicamente para él.

## Panel combinado

Abra **Agri Dashboard** para una vista en una sola pantalla de ambas mitades del negocio a la vez — consumibles con poco stock, lotes por vencer/vencidos, cantidad total de equipos y equipos con garantías por vencer pronto — en lugar de revisar dos pantallas separadas.

El mismo panel también rastrea las **fechas de servicio pendientes del equipo** — el próximo servicio programado de un tractor o rociador, independiente del vencimiento de su garantía. Establezca una fecha de servicio para cualquier equipo registrado directamente desde el panel Equipment Service Due, y Sarang lo marcará allí una vez que esté próximo a vencer o vencido. Toque **Remind** en una unidad marcada para enviar al cliente un recordatorio por WhatsApp con la fecha de vencimiento.

## Informes de Exposición de Crédito Estacional y Reembolso de Agricultores

Dos informes en la pantalla de Reportes son específicos de este tipo de negocio. **Exposición de Crédito Estacional (Seasonal Credit Exposure)** muestra cada factura de crédito pendiente actualmente agrupada por su mes de vencimiento a lo largo del año calendario, además de un desglose separado por Temporada de Cultivo vinculada — para que pueda ver de un vistazo cuándo su exposición de crédito alcanza su punto máximo durante el año, lo que para la mayoría de las tiendas de insumos agrícolas se concentra en torno a los meses de cosecha. **Historial de Compras y Pagos por Agricultor (Farmer-Wise Purchase & Repayment History)** clasifica a cada cliente de crédito según qué tan confiablemente reembolsa realmente, con las cuentas de mayor riesgo primero — a diferencia del Customer Ledger de un solo cliente, esta es la comparación entre varios agricultores que le indica a quién otorgar crédito fácil la próxima temporada y de quién cobrar primero.

## Logística y Cadena de Suministro

Debido a que los distribuidores de insumos agrícolas reciben rutinariamente entregas formales de proveedores (sacos de fertilizante y equipo llegando por camión), el conjunto completo de módulos de Logística y Cadena de Suministro está activado por defecto — Flota, Transportistas, Envíos, GRN (recepción de mercancía), Albarán de Entrega, Libro de Fletes y Análisis de Logística aparecen todos en la barra lateral sin necesidad de activarlos por separado.

## Todo lo demás

Facturación, Clientes y Proveedores, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos — nada de este tipo de negocio cambia cómo factura una venta o recibe un pago.

## Idioma

Insumos y Equipos Agrícolas no es uno de los rubros de servicio profesional de Sarang, así que no tiene bloqueo de idioma — la interfaz completa está disponible en los 13 idiomas admitidos por Sarang, igual que Minorista, Farmacia, o cualquier otro tipo de negocio por categoría de producto.
