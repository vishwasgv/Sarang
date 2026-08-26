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

Abra **Tasas de Metal** en la barra lateral para establecer la tarifa de hoy por gramo para cada combinación de tipo de metal y pureza que tiene en stock (el oro de 22K y el oro de 18K genuinamente se cotizan a tarifas diferentes, así que cada combinación obtiene su propia fila). No hay una fuente automática de tarifas por internet — coherente con el diseño de Sarang centrado en lo sin conexión, usted consulta la tarifa de hoy donde normalmente lo hace y la escribe. Actualice esto cada vez que la tarifa cambie; cada venta a partir de ese momento usa el valor actual.

## Cómo se fija el precio de una venta

Al momento de facturar, agregar un artículo de joyería al carrito busca la tarifa actual de su tipo de metal y pureza, calcula el valor del metal (peso neto × tarifa), agrega el cargo por elaboración, y usa eso como el precio unitario de la línea. Si aún no se ha configurado una tarifa para la combinación de metal/pureza de ese artículo, Sarang no le permitirá facturarlo en cero — se le pedirá que primero configure la tarifa de hoy.

¿Necesita negociar el cargo por elaboración para una venta en particular sin cambiar la tarifa configurada del producto? Edítelo directamente en la línea del carrito — el precio de la línea se recalcula de inmediato, y una línea modificada se marca visualmente para que sea evidente de un vistazo que no está usando el cargo estándar.

Si el artículo tiene un **número de sello/HUID** registrado en el producto, se captura en la venta y se imprime en la factura automáticamente.

## Cambio de metal usado

Abra **Cambio de Metal Usado** para registrar a un cliente que entrega oro o plata usados a cambio de una nueva compra. Ingrese el peso bruto, un peso de deducción (por cualquier contenido que no sea metal), tipo de metal y pureza — Sarang busca la tarifa de hoy para esa combinación y calcula el valor a entregar al cliente (peso neto × tarifa).

Para usarlo, haga clic en **Aplicar Cambio de Metal Usado** mientras factura a ese cliente — Sarang muestra el crédito y lo incorpora directamente al descuento de la factura a medida que se crea la venta, y marca el cambio como usado para que nunca pueda aplicarse accidentalmente por segunda vez a otra factura.

Cada registro de cambio también muestra un **peso equivalente puro** junto a su peso bruto — el peso neto normalizado por pureza (una pieza de 24g en 22K son 22g de oro puro), de modo que un cambio de 22K y uno de 18K sean directamente comparables de un vistazo, no solo en gramos brutos.

## Ahorro en Oro

Abra **Ahorro en Oro** en la barra lateral para gestionar un plan de ahorro tipo "chit" del cliente — depósitos mensuales fijos para una compra futura. Cree un plan con un monto mensual, una duración en meses y una fecha de inicio, luego registre cada **cuota** a medida que el cliente la paga; el total depositado del plan se actualiza automáticamente.

Cuando el cliente esté listo para comprar, **canjee** el plan — añadiendo opcionalmente un monto de bonificación si los propios términos del plan incluyen uno (p. ej. "pague 11 meses, obtenga el 12º gratis") — luego aplique el total canjeado como descuento en la factura de compra del cliente usted mismo en Facturación, de la misma manera que se aplica un crédito de cambio de metal usado.

## Devoluciones

Joyería tiene el módulo de Devoluciones activado, el mismo flujo de trabajo de procesamiento de devoluciones que usan Minorista, Ropa y Calzado.

## Informes

**Informes** incluye un informe de existencias de joyería que muestra el peso neto, la tasa actual y la valoración total agrupados por tipo de metal y pureza, además de cuatro más: **Margen de Cargo por Elaboración vs. Valor del Metal** desglosa el margen real por venta — cuánto de cada factura es valor del metal frente al cargo por elaboración, en lugar de un número combinado para todo el período. **Registro de Cumplimiento de Sello / HUID** enumera cada artículo de joyería activo y señala a cuáles les falta un número de sello BIS/HUID, para que un vacío pueda encontrarse y corregirse antes de una inspección, no después. **Tasa de Metal vs. Volumen de Ventas** correlaciona las fluctuaciones de la tasa con lo que realmente vendió, eligiendo automáticamente el metal y la pureza que más se movieron en el período. **Análisis de Cambio Ajustado por Pureza** lleva el cambio de metal usado más allá del registro bruto — normalizando cada cambio a su peso equivalente en metal puro, para que los cambios de diferentes purezas puedan compararse y analizarse en tendencia de forma justa.

## Idioma

Joyería no es una de las plantillas de negocio de servicio de Sarang — es un tipo de negocio por categoría de producto, así que **no** tiene bloqueo de idioma. La interfaz completa está disponible en los 13 idiomas admitidos.
