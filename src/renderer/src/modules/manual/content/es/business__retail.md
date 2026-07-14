# Minorista

Elegir **Minorista** como su tipo de negocio activa **Devoluciones** más el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una tienda minorista.

## Devoluciones

Abra **Returns** desde la barra lateral para procesar una devolución o cambio de un cliente contra una venta anterior. Busque la factura original por su número de factura, y Sarang carga sus artículos con una cantidad de **Devolución Máxima** para cada uno — esta es la cantidad original menos cualquier cosa ya devuelta contra esa misma factura en una visita anterior, de modo que nunca pueda devolver accidentalmente más de un artículo del que el cliente realmente compró (Sarang también verifica y bloquea esto al guardar, no solo en el selector de cantidad).

Elija la cantidad a devolver para cada artículo usando los selectores +/−, ingrese un motivo (obligatorio) y envíe. Esto crea una **factura de devolución** propia (su propio número de factura, con el prefijo `RET-`) que revierte proporcionalmente los ingresos, el descuento y el impuesto de la venta original — no es un ajuste de inventario silencioso, es una transacción real y vinculada que puede encontrar después desde cualquiera de las dos facturas.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Minorista incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **GRN**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos. Una tienda minorista también puede activar extras transversales de forma independiente desde **Configuración → Funciones Adicionales de Negocio** — la generación/impresión de Código de Barras y la facturación Suelta/por Peso son opciones comunes para una tienda minorista, pero están desactivadas por defecto y no son específicas del tipo de negocio Minorista.
