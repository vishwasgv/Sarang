# Minorista

Elegir **Minorista** como su tipo de negocio activa **Devoluciones** más el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una tienda minorista.

## Devoluciones

Abra **Devoluciones** desde la barra lateral para procesar una devolución o cambio de un cliente contra una venta anterior. Busque la factura original por su número de factura, y Sarang carga sus artículos con una cantidad de **Devolución Máxima** para cada uno — esta es la cantidad original menos cualquier cosa ya devuelta contra esa misma factura en una visita anterior, de modo que nunca pueda devolver accidentalmente más de un artículo del que el cliente realmente compró (Sarang también verifica y bloquea esto al guardar, no solo en el selector de cantidad).

Elija la cantidad a devolver para cada artículo usando los selectores +/−, ingrese un motivo (obligatorio) y envíe. Esto crea una **factura de devolución** propia (su propio número de factura, con el prefijo `RET-`) que revierte proporcionalmente los ingresos, el descuento y el impuesto de la venta original — no es un ajuste de inventario silencioso, es una transacción real y vinculada que puede encontrar después desde cualquiera de las dos facturas.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Minorista incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **Nota de Recepción**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Informes

Abra **Informes → Lista de Liquidación de Stock Muerto** para ver cada producto que sigue en stock sin ninguna venta en los últimos 90 días — un gráfico de barras más una tabla completa, ordenados para que los productos que inmovilizan más dinero queden arriba, no solo los más antiguos. Cada fila muestra el stock actual del producto, su costo, y el **capital inmovilizado** resultante (stock × costo) — el dinero real que no hace nada en su estante. Un producto que nunca se ha vendido muestra "Nunca Vendido" en lugar de una fecha de última venta — una distinción honesta frente a uno que simplemente no se ha vendido recientemente. Use esta lista para decidir qué realmente necesita una rebaja, un paquete, o un impulso de liquidación — no una suposición basada en qué estante se ve polvoriento.

Abra **Informes → Tasa de Rotación por Categoría** en la barra lateral para ver, mes a mes, cuánto del stock disponible de cada categoría de producto realmente se está moviendo — un gráfico de barras agrupadas más una tabla completa, una barra por categoría por mes. Cada barra muestra la proporción de las unidades vendidas-más-en-stock de esa categoría que se vendieron ese mes: una categoría que se mueve rápido queda alta, una que se acumula en silencio queda baja. Cada mes mostrado se compara con su stock ACTUAL disponible, no con el nivel de stock histórico propio de ese mes, así que léalo como una vista de tendencia de lo que se está vendiendo ahora mismo, no como un historial exacto mes a mes — genuinamente útil para detectar qué categorías merecen más espacio en estantería o un pedido mayor, y cuáles deben frenarse, sin revisar docenas de productos individuales uno por uno.

Abra **Informes → Composición de la Cesta** en la barra lateral para ver qué productos compran juntos con más frecuencia sus clientes en la misma venta — un gráfico de barras más una tabla completa con cada par de productos, ordenada por cuántas cestas contenían ambos. El resumen que lo acompaña muestra el número total de cestas en el período, el promedio de artículos diferentes por cesta, y el valor promedio de la cesta. Úselo para decidir qué colocar uno junto al otro en la estantería, o qué oferta combinada está realmente respaldada por el comportamiento de compra real, no por una suposición.

## Rebajas de Precio

Abra **Rebajas de Precio** desde la barra lateral para reducir el precio de un producto por tiempo limitado y que vuelva por sí solo — sin necesidad de recordar cambiarlo de nuevo. Elija un producto, fije el precio rebajado y elija la fecha en que debe terminar; el nuevo precio se aplica al producto de inmediato, y Sarang restaura automáticamente el precio original una vez que pasa esa fecha (se verifica al iniciar la aplicación y aproximadamente cada hora, así que no necesita tener la aplicación abierta en ese momento exacto). Solo una rebaja puede estar activa en un producto a la vez — cancele la actual primero si necesita cambiar los términos.

Si usted mismo cambia el precio de venta de ese producto mientras una rebaja sigue activa, Sarang lo detecta: la reversión automática se omite en lugar de sobrescribir su cambio manual, y la rebaja simplemente se cierra marcada como "Cambiada Manualmente" en lugar de "Revertida" — así una rebaja nunca puede deshacer silenciosamente una decisión de precio que usted tomó a propósito. Use **Cancelar** en una rebaja activa para terminarla antes de tiempo — si el precio no se ha tocado desde que comenzó la rebaja, vuelve al original de inmediato; si se ha tocado, cancelar solo detiene el seguimiento de la rebaja sin tocar el precio. **Verificar Ahora** en esta pantalla ejecuta la misma verificación de reversión bajo demanda, por si no quiere esperar al siguiente ciclo automático.

## Programa de Fidelidad

Abra **Programa de Fidelidad** desde la barra lateral para llevar una simple recompensa por tarjeta de sellos — defina cuántas visitas ganan una recompensa y cuál es esa recompensa (un artículo gratis, un porcentaje de descuento, lo que quiera ofrecer). Una vez activado, se añade un sello automáticamente a la tarjeta de un cliente en cada venta calificada — no hay ningún paso adicional al pagar, y puede establecer un monto mínimo de compra si solo quiere dar sellos en ventas por encima de cierto tamaño.

Esta pantalla muestra el progreso actual de cada cliente hacia su próxima recompensa, junto con cuántos sellos ha ganado en total y cuántas recompensas ya ha canjeado. Una vez que un cliente alcanza el objetivo, use **Canjear** aquí para darle su recompensa — esto usa exactamente los sellos necesarios, así que cualquier sello extra más allá del objetivo se traslada hacia la siguiente recompensa en lugar de perderse.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos. Una tienda minorista también puede activar extras transversales de forma independiente desde **Configuración → Funciones Adicionales de Negocio** — la generación/impresión de Código de Barras y la facturación Suelta/por Peso son opciones comunes para una tienda minorista, pero están desactivadas por defecto y no son específicas del tipo de negocio Minorista.
