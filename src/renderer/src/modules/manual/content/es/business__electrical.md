# Eléctrico

## Qué es diferente en este tipo de negocio

Una tienda eléctrica vende una mezcla de artículos contados por pieza (interruptores, MCBs, accesorios) y cable o alambre cortado a medida de una bobina — la misma bobina es un artículo de stock, pero cada venta tiene una longitud diferente. Eléctrico también activa el seguimiento de serie y garantía (para tableros eléctricos y otras unidades identificables individualmente), cuentas corrientes de obra para contratistas, y seguimiento de variantes (para calibres de cable, tamaños de accesorios, y otras especificaciones vendidas bajo un nombre de producto).

## Facturación de cable/alambre por metro

Al crear o editar un producto, active **Vender por Longitud** y elija una unidad (metros o pies) y un precio por unidad. Al momento de facturar, agregar ese producto al carrito lo agrega a una cantidad de una unidad de longitud en lugar de una pieza, con una entrada de cantidad de grano fino (paso de 0.1) para que un cajero pueda ingresar exactamente cuánto se cortó de la bobina — 4.5 metros, no "5 piezas."

## Cuentas de Obra

Abra **Job-Site Accounts** en la barra lateral para abrir una cuenta corriente para un contratista trabajando en un sitio específico — útil cuando el mismo electricista está comprando material para un trabajo en varias visitas y quiere rastrear lo que ese trabajo debe como su propio hilo, separado del libro mayor general del contratista como cliente. Cree una cuenta con un nombre (p. ej. "Residencia Sharma — Ala B"), el contratista al que se factura, y una dirección de sitio opcional.

Al facturar una venta a CRÉDITO a ese contratista, aparece un selector de **Job-Site Account** — seleccione la cuenta para etiquetar la factura a ella. Abra una cuenta desde la lista para ver cada factura etiquetada a ella y el total facturado y pendiente en curso. Una cuenta solo se puede cerrar una vez que su saldo pendiente está completamente saldado.

## Constructor de Kits de Trabajo

Al editar un producto y marcarlo como kit (vea el capítulo de Inventario para cómo funcionan los kits en general), los productos Eléctricos obtienen un botón extra **Suggest from past orders** en el editor de componentes del kit. Examina el historial real de facturas de lo que realmente se ha comprado junto con este producto antes — un ventilador de techo vendido junto con cable, un interruptor, y una caja de conexiones, por ejemplo — y prellena la lista de componentes con los acompañantes más frecuentes y sus cantidades típicas. Revise, ajuste, o elimine cualquier línea sugerida antes de guardar; nada se agrega al kit hasta que guarde.

## Informes

Junto con los informes estándar de Ventas, Inventario y Financieros, Eléctrico obtiene:

- **Desperdicio y Rendimiento de Bobina** — para cada producto vendido por longitud, cuánto se recibió (de registros de compra), cuánto se vendió realmente por longitud, y cuánto se registró como baja/ajuste de stock. El porcentaje de rendimiento y el desperdicio estimado facilitan detectar una bobina que está perdiendo más material en recortes de lo esperado.
- **Más Vendidos por Especificación** — la misma matriz de velocidad de venta versus margen de rápidos/lentos movedores que usan las tiendas de Ferretería, leída para Eléctrico: bajo seguimiento de variantes, el nombre y SKU de un producto ya llevan su especificación (calibre de cable, tamaño de accesorio), así que esto clasifica qué especificaciones realmente se mueven rápido y cuáles están quietas.
- **Registro de Seguridad ISI/BIS** — un registro de trazabilidad de cada unidad con seguimiento de serie: qué producto, su número de serie/lote, cuándo se recibió, su garantía, y cuándo y a qué factura se vendió — el registro que necesitaría a mano para una verificación de cumplimiento de seguridad o un retiro de producto.

## Idioma

Eléctrico no es una de las plantillas de negocio de servicios de Sarang — es un tipo de negocio por categoría de producto, así que **no** está bloqueada por idioma. La interfaz principal está disponible en los 13 idiomas compatibles.
