# Abarrotes / Tienda Kirana

## Qué es diferente en este tipo de negocio

Una tienda de Abarrotes/Kirana vende un alto volumen de productos de vida útil corta (seguimiento de lote/vencimiento activado por defecto), extiende crédito corriente "khata" a clientes habituales, y a menudo vende productos básicos como granos, legumbres y aceite sueltos por peso en lugar de preempaquetados. Abarrotes combina el seguimiento de lote/vencimiento de Farmacia con los módulos de límite de crédito y análisis de saldo pendiente de Distribuidor — una combinación probada, no una nueva.

## Recordatorio Automático de Khata (Crédito)

Abra el informe **Outstanding** — cualquier cliente con un saldo khata vencido obtiene su propio informe de **Nivel de Riesgo Khata** (vea abajo) con un botón de un toque **Send Reminder** junto a su nombre. Presionarlo abre WhatsApp con un mensaje prellenado indicando su saldo pendiente, y registra cuándo se envió el recordatorio para que el mismo cliente no sea recordado de nuevo durante al menos 7 días. Como con cada compartir de WhatsApp en Sarang, la app se transfiere a WhatsApp y no puede confirmar que el mensaje realmente se envió — depende de usted presionar enviar.

## Facturación Suelta (Por Peso)

La facturación suelta no es exclusiva de Abarrotes — es un interruptor por producto disponible para cualquier tipo de negocio (vea **Producto → Vender por Peso**). Para una tienda Kirana es cómo se cotizan típicamente los granos, legumbres y aceite: establezca un precio por kilogramo/litro en el producto, y la pantalla de facturación factura por el peso ingresado en el mostrador en lugar de un precio fijo por unidad.

## Informes

Junto con los informes estándar de Ventas, Inventario y Financieros, Abarrotes obtiene:

- **Cumplimiento de MRP** — cada línea de venta pasada donde el precio unitario excedió el MRP impreso del producto, con el exceso cobrado — una verificación de cumplimiento real, no solo un número de referencia.
- **Desperdicio de Perecederos** — stock dado de baja por vencimiento (use el motivo **Vencimiento** al ajustar stock por productos vencidos), por producto y valor.
- **Alerta de Reabastecimiento Diario** — productos de venta rápida con poco stock, clasificados por cuántos días de stock quedan al ritmo de ventas actual.
- **Mezcla de Ventas Sueltas vs. Empaquetadas** — cuánto de sus ingresos proviene de productos sueltos (facturados por peso) frente a SKUs preempaquetados.
- **Nivel de Riesgo Khata** — cada cliente de crédito clasificado por riesgo, combinando cuán vencida está su deuda más antigua con si su saldo ha estado subiendo o bajando en los últimos 30 días — señala a un cliente habitual deslizándose hacia una deuda incobrable antes de que realmente incumpla, no solo una lista estática de saldos.

## Idioma

Abarrotes no es una de las plantillas de negocio de servicios de Sarang — es un tipo de negocio por categoría de producto, así que **no** está bloqueada por idioma. La interfaz principal está disponible en los 13 idiomas compatibles.
