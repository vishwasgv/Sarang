# Ropa

Elegir **Ropa** como su tipo de negocio activa el **seguimiento de variantes de talla/color**, **Devoluciones** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una tienda de ropa.

## Seguimiento de variantes (talla y color)

Un artículo de ropa por lo general no es un único número de stock — "Camiseta de Hombre" podría existir en cinco tallas y cuatro colores, cada uno con su propio conteo de stock. Desde **Productos**, toque el ícono de capas en cualquier producto para abrir **Manage Variants**. Agregue una fila por cada combinación de talla/color que realmente tiene en stock (los campos de talla y color sugieren tallas de ropa comunes mientras escribe — de XS a 3XL — pero puede escribir cualquier cosa), cada una con su propio SKU opcional, un precio adicional sobre el precio base del producto si esa variante cuesta más (p. ej. una talla grande), y su propia cantidad de stock. La pantalla muestra un total corriente de variantes y el stock combinado de todas ellas.

Los registros de producto para un negocio de Ropa también obtienen un campo opcional de **Género** (Hombre/Mujer/Unisex) para ayudarlo a organizar su catálogo.

¿Necesita cargar muchas combinaciones a la vez? Use **Generate Size × Colour Matrix** al final de Manage Variants — escriba sus tallas y colores como listas separadas por comas (p. ej. "S, M, L" y "Negro, Blanco") y Sarang crea cada combinación como una fila nueva de una sola vez, omitiendo cualquier par que ya haya agregado a mano.

Cada fila de variante tiene su propio **código de barras** — genere uno por fila, o use **Generate Missing Barcodes** para completar todas las variantes que aún no tienen uno. Al imprimir etiquetas, un producto con seguimiento de variantes abre un selector para que la etiqueta lleve el código de barras y el precio propios de esa variante exacta, no los del producto principal.

## Vender una variante

En **Facturación**, agregar un producto que tiene variantes configuradas no lo agrega directamente al carrito — abre un selector para que elija la combinación exacta de talla/color que se vende, y el stock y precio de esa variante específica (precio base + su precio adicional, si lo hay) es lo que realmente entra al carrito. Esto mantiene sus conteos de stock por talla/color precisos, en lugar de simplemente decrementar un número compartido para todo el producto.

## Devoluciones

Ropa también obtiene la pantalla estándar de **Devoluciones** — busque una factura anterior por número, seleccione qué artículos y cantidades devolver (limitado a lo que realmente aún se puede devolver, teniendo en cuenta cualquier cosa ya devuelta antes), dé un motivo y envíe. Vea la sección de *Devoluciones* del capítulo de Minorista para el comportamiento completo — funciona de manera idéntica aquí.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Ropa incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **GRN**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
