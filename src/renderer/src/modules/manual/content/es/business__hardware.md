# Ferretería

Elegir **Ferretería** como su tipo de negocio activa el **precio por área**, la **aplicación de límite de crédito** y el conjunto compartido de módulos de **Logística**. Todo lo demás — Facturación, Productos, Clientes, Inventario, Informes — funciona exactamente como se describe en esos capítulos; este capítulo cubre lo específico de una ferretería.

## Precio por área (calculadora L × A)

Las ferreterías a menudo venden productos con precio por pie/metro cuadrado — baldosas, láminas, vidrio, madera contrachapada — donde el cliente no sabe el área de memoria. En **Facturación**, cualquier línea del carrito para un negocio de Ferretería muestra un pequeño botón de **Área** junto a su selector de cantidad. Al tocarlo se abre una calculadora de largo × ancho: ingrese ambas dimensiones, y Sarang calcula el área y la establece directamente como la cantidad de la línea, en la unidad en que se vende el producto. Esto no cambia cómo se fija el precio del producto — es una calculadora de conveniencia que completa la cantidad correcta para que no necesite una aplicación de calculadora separada en el mostrador. La misma calculadora está disponible al construir una **Cotización**, así que un presupuesto con precio por área es igual de fácil de armar que una venta en vivo.

Si tiene permiso para ver las cifras de ganancias, la calculadora también muestra una **vista previa del margen** en vivo tan pronto como se completan ambas dimensiones — el porcentaje de margen exacto que ganará esta línea con el área calculada y el precio actual de la línea, codificado por color (verde/ámbar/rojo) para que pueda detectar un margen bajo o negativo antes de confirmar la venta. Un cajero sin permiso para ver ganancias nunca ve esta línea, de la misma forma que las cifras de margen se ocultan de ellos en cualquier otro lugar de Sarang.

## Conversión de unidades de cartón/caja

Si compra por cartones pero vende por pieza, active la **facturación por paquete** para un producto y establezca cuántas piezas hay en un paquete. Al recibir stock, **Stock Adjustment** ofrece un modo de entrada de "paquetes recibidos" — ingrese el número de paquetes/cartones y Sarang calcula el conteo equivalente de piezas por usted. Todo lo demás (facturación, alertas de poco stock, valuación) sigue funcionando en piezas como de costumbre; esto solo cambia cómo *ingresa* el stock recién recibido.

Dos lugares leen este mismo tamaño de cartón para darle un número más inteligente y consciente del cartón en lugar de un simple conteo de piezas. En **Informes → Informe de Inventario**, el stock de un producto facturado por paquete muestra ambas formas juntas — p. ej. "100 (4 cajas + 4 unidades)" — para que pueda ver de un vistazo si le quedan solo unidades sueltas de una caja abierta, sin hacer la división usted mismo. Y cuando use **Inventario → Generar Órdenes de Reposición** para un producto facturado por paquete que haya caído por debajo de su nivel de reposición, la cantidad de pedido sugerida se redondea automáticamente hacia arriba a un número entero de cajas — un proveedor vende cajas completas, no un conteo fraccionario de piezas, así que un borrador que pida "37 unidades" nunca fue realmente pedible tal como estaba escrito.

## Baja por daño / rotura

Al ajustar el stock hacia abajo por daño o rotura real en lugar de una corrección rutinaria, elija **Damage** como categoría de motivo en el formulario de Stock Adjustment. Esto lo registra de forma distinta a un ajuste genérico, para que su historial de Inventory Movements y sus informes puedan diferenciar las pérdidas por rotura de las correcciones de stock ordinarias.

## Aplicación de límite de crédito

Las ferreterías frecuentemente venden a contratistas y negocios habituales en condiciones de crédito (pago después). Asigne a un cliente un **límite de crédito** desde su registro en **Clientes**, y Sarang bloqueará cualquier nueva venta *a crédito* que empujaría su saldo pendiente por encima de ese límite — la factura se rechaza de plano al momento de guardar, con un mensaje que muestra su saldo pendiente actual, el monto de la nueva factura y su límite, en lugar de permitirse silenciosamente y notarse solo después. Esta verificación solo se aplica a ventas por método de Crédito; las ventas en Efectivo, UPI, Tarjeta y Pago Dividido (que se pagan por completo de inmediato) nunca se ven afectadas. Un límite de crédito de 0 significa que no se aplica ningún límite para ese cliente.

Así es exactamente como funciona la **cuenta corriente** de un contratista día a día: cada venta a crédito se suma a su saldo en el momento en que ocurre — sin necesidad de configurar una "cuenta corriente" aparte. Cuando llegue el momento de saldar cuentas, abra **Informes → Cuenta del Cliente**, busque al contratista y elija el rango de fechas que desea facturar (un mes, o cualquier otro período) — genera un estado de cuenta completo con saldo inicial, cada transacción en orden, saldo final, y un gráfico de tendencia del saldo, ya detallado por artículo y totalizado, listo para entregar o exportar como PDF.

## Matriz de movimiento rápido vs. lento

En **Informes → Matriz de Movimiento Rápido vs. Lento**, cada producto que vendió en el rango de fechas elegido se grafica como un punto — qué tan rápido se vende (unidades por día) en un eje, y su porcentaje de margen en el otro. Las líneas discontinuas marcan la velocidad mediana y el margen mediano de ese período, dividiendo el gráfico en cuatro cuadrantes: movimiento rápido con buen margen, movimiento rápido pero margen bajo, movimiento lento pero que vale la pena mantener por su margen, y movimiento lento con margen bajo también — usualmente los candidatos más claros para descontinuar o liquidar. La tabla debajo del gráfico enumera cada producto con su velocidad, margen y cuadrante exactos, para que nunca tenga que adivinar mirando los puntos.

## Logística y Cadena de Suministro

Debido a que la plantilla predeterminada de Ferretería incluye los módulos de Logística, también obtiene **Flota**, **Transportistas**, **Envíos**, **Nota de Recepción**, **Albarán de Entrega**, **Libro de Fletes** y **Análisis de Logística** para rastrear sus propios vehículos de entrega y envíos de proveedores — vea las pantallas de Logística bajo esos nombres en la barra lateral.

## Lo que se comparte con todo negocio

Facturación, facturas, pagos, Clientes, Productos, Informes, Copia de Seguridad y Usuarios y Permisos funcionan exactamente como se describe en sus propios capítulos.
