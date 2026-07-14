# Inventario

## Agregar y editar productos

Abra **Productos** desde la barra lateral para ver su lista completa de productos, filtrable por categoría. Haga clic en **Add Product** para crear uno, o en el ícono de edición de cualquier fila para modificarlo. Los campos principales de un producto son:

- **Nombre del Producto**, **SKU**, **Código de Barras**, **Código HSN**, y una breve **Descripción**.
- **Tipo de Producto** — Estándar (un artículo físico con stock rastreado) o Servicio (sin stock que rastrear, p. ej. un cargo por mano de obra).
- **Unidad** — elija de una lista fija (PCS, KG, G, L, ML, M, CM, SQFT, SQM, BOX, DOZEN, PACKET, PAIR, SET, BOTTLE, BAG, ROLL, HOUR, SERVICE).
- **Precio de Costo**, **Precio de Venta**, y **Tasa de Impuesto** — la tasa de impuesto se puede escribir libremente, o aplicarse con un clic desde cualquier tasa configurada en **Settings → Tax Configuration**.
- **Nivel de Reposición** y **Cantidad de Reposición** — el umbral de stock que dispara una alerta de stock bajo, y cuánto normalmente volvería a pedir.
- **Cantidad Inicial** — el conteo de stock con el que se comienza cuando el producto se crea por primera vez.
- Una **imagen de producto** opcional.

Las **Categorías** se gestionan desde el botón **Category** en la pantalla de Productos, lo que le permite agrupar productos para filtrado e informes.

Algunos tipos de producto son opcionales y solo se muestran cuando la función correspondiente está activada para su negocio (desde **Settings → Additional Business Features** o la propia plantilla de su tipo de negocio): venta por peso/facturación suelta, variantes de talla/color, artículos alquilables, y precios de metal de joyería. Estos son opcionales por producto — activar una función no obliga a que cada producto entre en ese modo. El seguimiento de lotes/caducidad, el seguimiento de serie/IMEI, y otros comportamientos de stock específicos del tipo de negocio se cubren en el capítulo correspondiente al tipo de negocio, no aquí.

## Niveles y movimientos de stock

**Inventario** (`/inventory`) lista el stock actual de cada producto, su nivel de reposición, costo promedio y valor de stock, con un conteo continuo de artículos con stock bajo y agotados mostrado como insignias de alerta en la parte superior. Cambie entre **All** y **Low Stock** usando las pestañas.

Para corregir manualmente un conteo de stock — después de un conteo físico, daño, o un saldo inicial — haga clic en el ícono de ajuste de stock en una fila. Ingrese la nueva cantidad (no la diferencia); la pantalla le muestra cuánto se agregará o quitará antes de guardar, y requiere un motivo. Si está aumentando el stock, opcionalmente puede registrar el costo por unidad para esa incorporación, lo que alimenta el costo promedio del producto usado para la valoración.

Cada cambio en el stock — una venta, un ajuste manual, una orden de compra recibida, una devolución, o una corrida de producción — se registra como un **movimiento** inmutable. **Inventory Movements** (`/inventory/movements`, al que se llega mediante el botón **Movements**) es un libro de solo lectura de cada uno de estos, filtrable por tipo (Stock Agregado, Venta, OC Recibida, Ajuste, Devolución de Venta, Devolución Recibida, Despachado, Producido) y con búsqueda, para que siempre pueda rastrear exactamente por qué el stock de un producto es el que es.

## Órdenes de Compra (Purchase Orders)

**Purchase Orders** (`/purchase-orders`) rastrea lo que ha pedido a los proveedores. Cree una con **New PO**: elija un proveedor, agregue líneas de artículos (buscados por nombre de producto o SKU) con cantidad, costo unitario y tasa de impuesto, y una fecha de entrega esperada opcional.

Una orden de compra pasa por un ciclo de vida fijo:

1. **Draft** — todavía editable.
2. **Approve** para bloquearla contra más cambios.
3. **Receive Stock** — este es el paso que realmente agrega las cantidades pedidas a su inventario y registra un movimiento de COMPRA para cada artículo. Una vez recibida, la OC muestra el nivel de stock resultante de cada artículo junto a la línea del pedido.
4. Una OC en estado Draft o Approved puede en cambio ser **cancelada**, con un motivo.

## Visibilidad de stock bajo

Los conteos de stock bajo y agotado aparecen en tres lugares que se mantienen siempre sincronizados: las insignias de alerta en la parte superior de la pantalla de Inventario, los mosaicos de stock bajo y agotado en el Panel, y el filtro de stock bajo en las pantallas de Productos/Inventario. Configurar un nivel de reposición sensato en cada producto (el valor predeterminado es 5) es lo que hace útiles estas alertas — un producto sin nivel de reposición configurado efectivamente nunca dispara una advertencia de stock bajo.
