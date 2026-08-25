# Ropa

Elegir **Ropa** como su tipo de negocio activa el **seguimiento de variantes de talla/color**, **Devoluciones** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una tienda de ropa.

## Seguimiento de variantes (talla y color)

Un artículo de ropa por lo general no es un único número de stock — "Camiseta de Hombre" podría existir en cinco tallas y cuatro colores, cada uno con su propio conteo de stock. Desde **Productos**, toque el ícono de capas en cualquier producto para abrir **Gestionar Variantes**. Agregue una fila por cada combinación de talla/color que realmente tiene en stock (los campos de talla y color sugieren tallas de ropa comunes mientras escribe — de XS a 3XL — pero puede escribir cualquier cosa), cada una con su propio SKU opcional, un precio adicional sobre el precio base del producto si esa variante cuesta más (p. ej. una talla grande), y su propia cantidad de stock. La pantalla muestra un total corriente de variantes y el stock combinado de todas ellas.

Los registros de producto para un negocio de Ropa también obtienen un campo opcional de **Género** (Hombre/Mujer/Unisex) y un campo de texto libre **Temporada / Colección** (p. ej. "Verano 2026", "Colección Diwali") para ayudarlo a organizar su catálogo.

¿Necesita cargar muchas combinaciones a la vez? Use **Generate Size × Colour Matrix** al final de Manage Variants — escriba sus tallas y colores como listas separadas por comas (p. ej. "S, M, L" y "Negro, Blanco") y Sarang crea cada combinación como una fila nueva de una sola vez, omitiendo cualquier par que ya haya agregado a mano.

Cada fila de variante tiene su propio **código de barras** — genere uno por fila, o use **Generate Missing Barcodes** para completar todas las variantes que aún no tienen uno. Al imprimir etiquetas, un producto con seguimiento de variantes abre un selector para que la etiqueta lleve el código de barras y el precio propios de esa variante exacta, no los del producto principal.

¿Listo para reordenar un producto pero no está seguro de cómo dividirlo entre las tallas? Abra **División de Reorden Sugerida** en la parte inferior de Gestionar Variantes, ingrese una cantidad total (o déjelo en blanco para usar la cantidad de reorden ya configurada del producto), y Sarang pondera la división hacia las tallas y colores que realmente se han estado vendiendo en los últimos 90 días — en lugar de dividir uniformemente. Es la solución al clásico problema de "se agotaron las tallas M y L tres semanas antes que S y XL, pero se reordenaron todas por igual de todos modos". Esto es solo una sugerencia, no un pedido en vivo — usted todavía coloca la Orden de Compra real, informado por la división.

## Vender una variante

En **Facturación**, agregar un producto que tiene variantes configuradas no lo agrega directamente al carrito — abre un selector para que elija la combinación exacta de talla/color que se vende, y el stock y precio de esa variante específica (precio base + su precio adicional, si lo hay) es lo que realmente entra al carrito. Esto mantiene sus conteos de stock por talla/color precisos, en lugar de simplemente decrementar un número compartido para todo el producto.

## Informe de Venta por Temporada/Colección

Si etiqueta sus productos con una **Temporada / Colección**, abra **Informes → Venta por Temporada/Colección** para ver, mes a mes, qué parte de las unidades vendidas-más-en-stock de cada colección realmente se vendió — una forma rápida de detectar qué colección se está moviendo y cuál se está acumulando silenciosamente en el estante. El gráfico muestra cada colección como su propia barra por mes, con una línea de tendencia de promedio general superpuesta; el número se compara con su stock actual disponible para cada mes mostrado, así que léalo como una tendencia continua, no como una instantánea histórica exacta de cada mes. Los productos sin temporada configurada quedan completamente excluidos de este informe — etiquete los que quiera rastrear.

## Informe de Mapa de Calor Talla × Estilo

Abra **Informes → Mapa de Calor Talla × Estilo** para ver una cuadrícula que muestra exactamente qué combinaciones de talla/producto ("estilo") realmente se están vendiendo — cada producto en el lateral, cada talla en la parte superior, cada celda sombreada según cuántas unidades de esa combinación exacta se vendieron en el rango de fechas que elija. Las celdas más oscuras significan más unidades vendidas; una celda en blanco significa que esa combinación talla/estilo no se vendió en absoluto. Está diseñado para detectar patrones que una simple lista de ventas ocultaría — un estilo que solo se vende en M y L, o una talla que nunca se vende sin importar el estilo. La cuadrícula muestra sus 15 estilos más vendidos por volumen, para que se mantenga legible incluso en un catálogo grande.

## Informe de Margen por Marca/Proveedor

Asigne un **Proveedor** a sus productos (pantalla de Productos — el mismo campo usado para compras) y abra **Informes → Margen por Marca/Proveedor** para ver los ingresos, el costo y el margen desglosados según de qué proveedor provino cada producto vendido. Esto responde a una pregunta distinta de la propia vista de valor de stock por producto del Informe de Inventario — se trata de qué marcas/proveedores son realmente rentables de mantener, no solo cuáles venden más. Un proveedor cuyo margen resulta negativo se muestra honestamente como una pérdida, sin ocultarlo ni limitarlo a cero — ese es exactamente el caso que vale la pena detectar. Los productos sin proveedor asignado quedan totalmente excluidos de este informe — asigne los que quiera rastrear.

## Devoluciones

Ropa también obtiene la pantalla estándar de **Devoluciones** — busque una factura anterior por número, seleccione qué artículos y cantidades devolver (limitado a lo que realmente aún se puede devolver, teniendo en cuenta cualquier cosa ya devuelta antes), dé un motivo y envíe. Vea la sección de *Devoluciones* del capítulo de Minorista para el comportamiento completo — funciona de manera idéntica aquí.

Para una línea con variante (cualquier producto vendido con talla/color), la pantalla de Devoluciones también ofrece un botón de **Cambio** junto al selector de cantidad a devolver — para cuando el cliente quiere una talla o color distinto, no un reembolso. Elija una cantidad, seleccione la talla/color de reemplazo entre lo que hay actualmente en stock, indique un motivo y confirme. Detrás de escena, esto crea dos transacciones vinculadas y totalmente reales en un solo paso: una factura de devolución para el artículo entregado (reponiéndolo en el stock y acreditando al cliente exactamente como lo haría una devolución normal) y una nueva factura de venta para el artículo de reemplazo, con el precio actual propio de ese artículo — no el precio del artículo anterior, de modo que un precio ya cambiado se refleje honestamente. Sarang muestra de inmediato la diferencia exacta: si el reemplazo cuesta más, cuánto adicional cobrar; si cuesta menos, cuánto reembolsar; y si los precios coinciden exactamente, no hay ningún saldo pendiente.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Ropa incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **Nota de Recepción**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
