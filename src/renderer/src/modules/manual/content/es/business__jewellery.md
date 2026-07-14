# Joyería

## Qué es diferente en este tipo de negocio

El precio de venta real de una pieza de joyería no es un número fijo que usted establece una vez — se calcula al momento de la venta, a partir del peso neto propio del artículo, la tarifa de mercado de hoy para su metal y pureza exactos, y un cargo por elaboración. Ningún otro mecanismo de precios en Sarang cubre esto, incluida la facturación suelta/por peso — esa función (usada para cosas como arroz o especias vendidas por peso) fija el precio con una tarifa fija por unidad de peso que *usted* establece y que permanece igual hasta que la cambie. El precio de la joyería es diferente específicamente porque la tarifa genuinamente fluctúa día a día con el mercado de metales, y hay que consultarla de nuevo cada vez.

## Configurar un producto de joyería

Al crear o editar un producto, configure su **Tipo de Metal** (Oro, Plata o Platino) y **Pureza** (p. ej. "22K", "18K", "999"). Ingrese su peso bruto y, si tiene piedras u otro material que no es metal, un peso de piedra a deducir — Sarang siempre calcula el peso neto como el bruto menos el peso de piedra por sí mismo; nunca se confía en un valor escrito directamente en el producto, de la misma manera que nunca se confía en el precio de una etiqueta de código de barras proveniente de una entrada externa.

Luego elija cómo se calcula el cargo por elaboración:

- **Monto fijo** — un cargo por elaboración plano sin importar el peso.
- **Por gramo (del peso neto)** — una tarifa multiplicada por el peso neto del artículo.
- **Porcentaje del valor del metal** — un porcentaje de (peso neto × tarifa de hoy).

## Tasas de Metal

Abra **Metal Rates** en la barra lateral para establecer la tarifa de hoy por gramo para cada combinación de tipo de metal y pureza que tiene en stock (el oro de 22K y el oro de 18K genuinamente se cotizan a tarifas diferentes, así que cada combinación obtiene su propia fila). No hay una fuente automática de tarifas por internet — coherente con el diseño de Sarang centrado en lo sin conexión, usted consulta la tarifa de hoy donde normalmente lo hace y la escribe. Actualice esto cada vez que la tarifa cambie; cada venta a partir de ese momento usa el valor actual.

## Cómo se fija el precio de una venta

Al momento de facturar, agregar un artículo de joyería al carrito busca la tarifa actual de su tipo de metal y pureza, calcula el valor del metal (peso neto × tarifa), agrega el cargo por elaboración, y usa eso como el precio unitario de la línea. Si aún no se ha configurado una tarifa para la combinación de metal/pureza de ese artículo, Sarang no le permitirá facturarlo en cero — se le pedirá que primero configure la tarifa de hoy.

## Cambio de metal usado

Abra **Old-Metal Exchange** para registrar a un cliente que entrega oro o plata usados a cambio de una nueva compra. Ingrese el peso bruto, un peso de deducción (por cualquier contenido que no sea metal), tipo de metal y pureza — Sarang busca la tarifa de hoy para esa combinación y calcula el valor a entregar al cliente (peso neto × tarifa). Esto es un registro independiente: el valor calculado no se conecta automáticamente a una factura. El personal lo aplica manualmente como un descuento en la nueva factura de compra del cliente, y luego vincula el registro de cambio de vuelta a esa factura después, para que ambos permanezcan conectados en sus registros.

## Devoluciones

Joyería tiene el módulo de Devoluciones activado, el mismo flujo de trabajo de procesamiento de devoluciones que usan Minorista, Ropa y Calzado.

## Informes

**Informes** incluye un informe de stock de joyería que muestra el peso neto, la tarifa actual y la valoración total agrupada por tipo de metal y pureza.

## Idioma

Joyería no es una de las plantillas de negocio de servicio de Sarang — es un tipo de negocio por categoría de producto, así que **no** tiene bloqueo de idioma. La interfaz completa está disponible en los 13 idiomas admitidos.
