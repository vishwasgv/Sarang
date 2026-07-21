# Farmacia

Elegir **Farmacia** como su tipo de negocio activa el **seguimiento de lotes**, el **seguimiento de caducidad** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una farmacia.

## Gestión de Lotes

Abra **Batch Management** desde la barra lateral para registrar cada lote de stock que recibe: producto, número de lote, cantidad recibida, fecha de caducidad, una fecha de fabricación opcional, costo unitario y de qué proveedor proviene. Cada lote rastrea su propia **cantidad restante** por separado de lo que se recibió originalmente, y la lista se puede filtrar a **Todos**, **Por Vencer Pronto** o **Vencidos**. Las insignias de alerta en la parte superior de la pantalla señalan cuántos lotes vencen dentro de 30 días o ya están vencidos, de modo que una revisión de stock nunca sea una sorpresa. Puede editar la fecha de caducidad, la fecha de fabricación, la cantidad restante o el costo de un lote más tarde, o desactivar un lote una vez que esté totalmente agotado o dado de baja.

## Cómo la venta extrae de los lotes

Usted no elige un lote manualmente al momento de la venta — Facturación extrae de su stock de lotes automáticamente, primero el lote que vence más pronto (FIFO por fecha de caducidad), para cualquier producto que tenga lotes registrados. Si el único stock de lote disponible para cubrir una venta ya ha vencido, Sarang bloquea la venta por defecto en lugar de dejar salir silenciosamente stock vencido — necesitaría registrar un lote nuevo y válido, o (solo si genuinamente lo desea) activar "Permitir venta de lote vencido" en Configuración para anular esto. Las devoluciones de un producto con seguimiento de lote restauran la cantidad de vuelta al lote correcto de la misma manera, de modo que los números de cantidad restante permanezcan precisos después de una devolución.

## Medicamentos de Lista H/H1

Marque un producto como **Prescription Required (Schedule H / H1)** en su formulario de Producto, y Facturación exigirá el nombre del paciente y el nombre del médico prescriptor antes de permitirle agregarlo a un carrito — la venta simplemente no puede completarse sin ambos, manteniéndolo en cumplimiento con los requisitos de registro de la Lista H/H1. Un informe dedicado de **Registro de Ventas de Medicamentos Recetados** (solo Farmacia) lista cada venta de este tipo con los detalles capturados de paciente/médico.

## Número de licencia de farmacia

Ingrese el **Drug License Number** de su farmacia en Configuración → Perfil del Negocio — es específico de este tipo de negocio y se muestra solo cuando Farmacia es su tipo de negocio activo.

## Reabastecimiento automático desde stock bajo

Establezca un **Default Supplier** en un producto (junto a su Nivel/Cantidad de Reabastecimiento en el formulario de Producto), y cuando ese producto se agote, use **Generar Órdenes de Reabastecimiento** en la barra de alerta de stock bajo en Inventario. Sarang redacta una orden de compra por proveedor, agrupando cada producto vencido que tenga un proveedor predeterminado configurado, y omite cualquier cosa que ya esté en una orden de compra abierta para que ejecutarlo de nuevo nunca cree duplicados — los productos sin proveedor predeterminado también se omiten, con un conteo que se muestra para que sepa qué todavía necesita atención manual.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Farmacia incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **GRN**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
