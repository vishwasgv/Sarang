# Facturas y Pagos Realizados

## Qué es una Factura, y en qué se diferencia de una Orden de Compra

Una **Orden de Compra** es lo que le *pediste* a un proveedor. Una **Factura** es lo que él realmente te *facturó* — ambos documentos están relacionados pero no son lo mismo. Puedes registrar una factura sin haber emitido nunca una orden de compra (el caso común de la factura de un subcontratista, un recibo de alquiler, o cualquier compra puntual), o puedes vincular una factura a una orden de compra existente como referencia.

Cada factura aumenta lo que debes a ese proveedor. El estado de una factura avanza a través de **Abierta → Parcialmente Pagada → Pagada** a medida que registras pagos contra ella, o puede **Anularse** si se registró por error (solo mientras aún no tenga pagos registrados — primero revierte los pagos).

## Registrar una Factura

Abre **Facturas** en la barra lateral y haz clic en **Registrar Factura**. Elige el proveedor (o añade uno nuevo sin salir del formulario — el mismo atajo **+ Añadir Nuevo Proveedor** también está disponible en el formulario de la Orden de Compra), luego añade una o más líneas.

Cada línea es una de estas dos opciones:

- **Producto** — un artículo real de tu catálogo, elegido en un menú desplegable con búsqueda. Su costo se autocompleta con el costo propio del producto, y puedes ajustarlo si esta compra en particular tuvo un precio diferente.
- **Servicio** — texto libre (p. ej. "Mantenimiento — trimestral", "Honorarios de consultoría legal"), opcionalmente etiquetado con una categoría. Esto es lo que cierra la brecha de larga data donde toda compra empresarial no destinada a reventa — equipo de oficina, consumibles, honorarios profesionales — no tenía ningún lugar estructurado. Mezcla líneas de producto y de servicio libremente en la misma factura.

Cada línea también lleva su propio monto de descuento y tasa de impuesto, de modo que los totales de la factura se calculan correctamente por línea antes de sumarse — el mismo orden de descuento-luego-impuesto que ya sigue cualquier otro documento en Sarang.

## Registrar un Pago contra una Factura

Abre una factura y haz clic en **Registrar Pago**. Los pagos a proveedores aceptan Efectivo, UPI, Tarjeta, Transferencia Bancaria o Cheque — un conjunto más amplio que los pagos de cara al cliente, ya que los pagos B2B suelen hacerse por transferencia bancaria o cheque. Un pago puede ser parcial; el saldo y el estado de la factura se actualizan de inmediato, y el monto se deduce de lo que le debes a ese proveedor.

Todos los pagos que hayas hecho en todas las facturas también aparecen en un solo lugar bajo **Pagos Realizados** en la barra lateral — buscable por número de factura, proveedor o número de referencia, con el mismo soporte de reversión (con un motivo obligatorio) que ya tienen los Pagos Recibidos, por si uno se registró por error.

## Informes del lado de las compras

Cuatro informes, todos bajo **Informes**, cubren lo que has comprado y lo que debes:

- **Registro de Compras** — cada factura en un rango de fechas, con un gráfico de gasto por proveedor y el detalle completo a nivel de línea. Es el equivalente del lado de compras al Informe de Ventas.
- **Compras por Proveedor** — gasto total y número de facturas, clasificados por proveedor, para saber a quién le compras realmente más.
- **Compras por Artículo** — gasto total y cantidad comprada, clasificados por producto o servicio, separando los artículos de inventario reales de las líneas de servicio en texto libre.
- **Resumen de Antigüedad de Cuentas por Pagar** — lo que actualmente debes a cada proveedor, agrupado según cuánto tiempo lleva vencido (Vigente / 1-30 / 31-60 / 61-90 / 90+ días), la misma lógica de antigüedad que ya usa el Informe de Saldos Pendientes para el lado de los proveedores, ahora como su propia vista dedicada.

## Mayor profundidad en el registro del proveedor

El registro propio de un proveedor (ábrelo desde **Proveedores**) ahora también puede contener cuenta bancaria/código IFSC/nombre del banco (para realizar pagos) y un número de PAN (para trámites de cumplimiento), además de un **Saldo Inicial** cuando añades por primera vez un proveedor que ya tiene deudas reales pendientes — esto registra un asiento único en su libro mayor para que su saldo sea correcto desde el primer día.

## Clientes Individuales vs. Empresariales

Un registro de cliente (ábrelo desde **Clientes**) ahora comienza con un interruptor **Individual / Empresarial**. Empresarial habilita los campos de número de registro de la empresa y persona de contacto designada; Individual habilita en su lugar un tipo y número de identificación — esto coincide con lo que un distribuidor o vendedor B2B realmente necesita registrar sobre a quién le está vendiendo, a diferencia de un cliente minorista ocasional.

## Gastos: Proveedor, Kilometraje y Facturable a Cliente

El formulario de **Gastos** ahora también acepta un proveedor opcional (para un gasto que tiene un proveedor real pero no necesita una factura completa), un desglose de kilometraje (distancia × tarifa por km, que calcula el monto por ti para que las dos cifras nunca puedan estar en desacuerdo), y un campo **Facturar esto a un cliente** para un gasto reembolsable que planeas cobrar de vuelta — por ejemplo, un viaje que un consultor le factura después al cliente.
