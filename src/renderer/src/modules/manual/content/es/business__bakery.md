# Panadería / Dulcería / Catering

## Qué es diferente en este tipo de negocio

Una panadería vende productos de rotación rápida y vida útil corta hechos a partir de recetas (harina, azúcar, mantequilla descontadas por cada torta vendida), toma pedidos personalizados de tortas reservadas con anticipación, y a menudo maneja pedidos de catering para eventos — 50 samosas y 20 cupcakes para una fiesta, comparados contra el catálogo y facturados de una sola vez. Panadería combina el seguimiento de recetas/ingredientes de Restaurante (sin el flujo de mesas/KOT de comedor — una venta de mostrador no es una comanda), el seguimiento de lote/vencimiento de Farmacia para vida útil corta, y el mecanismo de pedidos por lista masiva de Papelería reutilizado tal cual para catering.

## Deducción de Ingredientes Basada en Recetas

Configure una Receta en cualquier Producto horneado (Producto → Receta) igual que lo haría un plato de Restaurante — liste cada ingrediente y cuánto de él lleva una unidad. Como una venta de mostrador de panadería no tiene flujo de comanda de cocina, el stock de ingredientes se descuenta automáticamente en el momento en que se factura la venta, no en un paso separado de "pedido completado".

## Pedidos Personalizados

Abra **Custom Orders** en la barra lateral para reservar una torta personalizada o un producto hecho a pedido: elija el cliente, agregue cada artículo con su cantidad y precio, y opcionalmente capture la personalización de una línea — sabor, tamaño, mensaje o diseño. Establezca un monto de anticipo y cómo se cobró; el anticipo no puede exceder el total del pedido.

Cuando el pedido esté listo, use **Generate Invoice** en el pedido — esto crea la factura real a partir de los artículos propios del pedido y registra automáticamente el anticipo ya cobrado como un pago real contra ella.

## Pedidos de Catering por Lista

Abra **Bulk-List Orders** (la misma pantalla que usa Papelería para listas escolares) para manejar un pedido de catering: registre cada línea como texto libre ("50 samosas", "20 cupcakes"), asocie cada una a un producto real del catálogo, y facture todo el pedido de una sola vez una vez que cada línea esté asociada.

## Eventos de Catering

Abra **Eventos de Catering** en la barra lateral para una reserva de evento completa — una boda o un evento grande, no un pedido masivo del mismo día. Elija el cliente, la fecha de inicio (y fin, para eventos de varios días) del evento, la dirección del lugar, y el número de asistentes, luego establezca un **precio por plato** como cotización inicial. Agregue el menú del evento (productos reales del catálogo con cantidad y precio), un conteo de comidas y meriendas para cada día de servicio, y personal con su propio costo por rol — cocinero, mesero, personal de limpieza u otro, cada uno con su propia cantidad de trabajadores y tarifa por trabajador.

Una vez que el precio se negocia realmente, use **Registrar Precio Final** para capturar el total acordado — mantenido separado de la cotización original por plato, de modo que el descuento negociado siempre sea visible en lugar de sobrescribirse silenciosamente. **Generar Factura** en el evento factura al precio final negociado si se registró uno, o a la cotización original en caso contrario, como una sola línea de Servicio de Catering, y registra el anticipo ya cobrado como un pago real contra ella.

## Informes

Junto con los informes estándar de Ventas, Inventario y Financieros, Panadería obtiene:

- **Vida Útil / Desperdicio** — stock dado de baja por vencimiento (use el motivo **Vencimiento** al ajustar stock por productos vencidos), por producto y valor — el mismo informe que usa Abarrotes para perecederos.
- **Margen de Receta** — los informes de Costo de Alimentos y Margen de Contribución por Plato (del seguimiento de ingredientes de Restaurante) funcionan aquí sin cambios, ya que las deducciones de ingredientes de una panadería se registran exactamente de la misma manera.
- **Hoja de Producción por Pedido Anticipado** — elija una fecha, y vea cada pedido personalizado que vence ese día más la demanda típica de clientes sin cita para ese día de la semana, consolidado en qué hornear y exactamente cuánto necesitará de cada ingrediente.

## Idioma

Panadería no es una de las plantillas de negocio de servicios de Sarang — es un tipo de negocio por categoría de producto, así que **no** está bloqueada por idioma. La interfaz principal, incluida la pantalla de Pedidos Personalizados, está disponible en los 13 idiomas compatibles.
