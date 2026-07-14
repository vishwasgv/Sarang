# Farmacia

Elegir **Farmacia** como su tipo de negocio activa el **seguimiento de lotes**, el **seguimiento de caducidad** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una farmacia.

## Gestión de Lotes

Abra **Batch Management** desde la barra lateral para registrar cada lote de stock que recibe: producto, número de lote, cantidad recibida, fecha de caducidad, una fecha de fabricación opcional, costo unitario y de qué proveedor proviene. Cada lote rastrea su propia **cantidad restante** por separado de lo que se recibió originalmente, y la lista se puede filtrar a **Todos**, **Por Vencer Pronto** o **Vencidos**. Las insignias de alerta en la parte superior de la pantalla señalan cuántos lotes vencen dentro de 30 días o ya están vencidos, de modo que una revisión de stock nunca sea una sorpresa. Puede editar la fecha de caducidad, la fecha de fabricación, la cantidad restante o el costo de un lote más tarde, o desactivar un lote una vez que esté totalmente agotado o dado de baja.

## Cómo la venta extrae de los lotes

Usted no elige un lote manualmente al momento de la venta — Facturación extrae de su stock de lotes automáticamente, primero el lote que vence más pronto (FIFO por fecha de caducidad), para cualquier producto que tenga lotes registrados. Si el único stock de lote disponible para cubrir una venta ya ha vencido, Sarang bloquea la venta por defecto en lugar de dejar salir silenciosamente stock vencido — necesitaría registrar un lote nuevo y válido, o (solo si genuinamente lo desea) activar "Permitir venta de lote vencido" en Configuración para anular esto. Las devoluciones de un producto con seguimiento de lote restauran la cantidad de vuelta al lote correcto de la misma manera, de modo que los números de cantidad restante permanezcan precisos después de una devolución.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Farmacia incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **GRN**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
