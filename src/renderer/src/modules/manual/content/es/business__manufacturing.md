# Fabricación

Fabricación transforma a Sarang de un sistema de comprar-y-vender a uno de fabricar-y-vender: usted rastrea las materias primas que ingresan, define lo que realmente necesita un producto terminado para fabricarse, ejecuta órdenes de producción que consumen materiales y producen stock, y luego despacha los productos terminados hacia los clientes. Fabricación también obtiene por defecto el conjunto completo de módulos de Logística y Cadena de Suministro (Flota, Transportistas, GRN, Fletes), ya que recibir consignaciones formales de materia prima de proveedores es una parte normal de administrar una planta de producción.

## 1. Materias Primas

**Materias Primas** es su inventario de ingredientes/componentes, separado de su stock de productos regular. Cada material tiene un nombre, una unidad (kg, litro, pieza, caja y similares), un nivel de reabastecimiento y un costo unitario. La lista señala cualquier cosa por debajo de su nivel de reabastecimiento y totaliza el valor de su stock actual.

El stock solo se mueve a través de **Adjust Stock**, que registra uno de tres tipos de movimiento — Compra (entrada de stock), Devolución (entrada de stock), o Ajustar A (una corrección manual) — más un cuarto tipo, Consumido, que el sistema crea automáticamente cada vez que se inicia una orden de producción (vea más abajo). Cada movimiento se registra con un saldo corriente en **Movement History**, para que pueda ver exactamente por qué el stock de un material es el que es.

## 2. Lista de Materiales (LDM)

Una LDM define lo que un producto terminado realmente necesita: elija el producto, establezca una cantidad de salida por lote, y liste lo que consume — ya sea una materia prima, o **otro producto fabricado como subensamble** (alterne el tipo de la fila), con una cantidad necesaria y un porcentaje de merma opcional. La merma infla la cantidad efectiva consumida (p. ej. 5% de merma sobre 10 kg necesarios significa que en realidad se planifican 10.5 kg para el consumo). Al construir un producto de varios niveles — digamos un Auto que necesita un Motor, que a su vez se fabrica a partir de Acero crudo — Sarang verifica referencias circulares (un componente que eventualmente necesitaría de sí mismo) y bloquea guardarlo. Sarang totaliza el costo de material por lote a partir del costo unitario actual de cada ingrediente — esta es la base de costo que usará después una orden de producción.

Solo se permite una LDM por producto; editar una LDM existente le permite cambiar cantidades, merma y las filas de componentes, pero no para qué producto es.

Las materias primas recibidas en lotes distintos (una entrega de hoy puede costar diferente a la del mes pasado) pueden rastrearse como **lotes de material** desde Materias Primas — reciba un lote con su propia cantidad, y una orden de producción automáticamente toma del lote más antiguo primero (FIFO), para que siempre sepa exactamente qué lote entró en qué corrida de producción.

## 3. Órdenes de Producción

Este es el flujo de trabajo central de fabricación, y pasa por cuatro estados:

- **Draft** (Borrador) — elige un producto con una LDM y una cantidad planificada; Sarang calcula exactamente cuánto de cada materia prima necesita ese plan.
- **In Progress** (En Proceso) — iniciar una orden verifica que cada materia prima requerida tenga suficiente stock; si algo falta, le indica exactamente qué y cuánto, y se niega a iniciar. Una vez iniciada, las materias primas se deducen de inmediato (registradas como un movimiento "Consumido" contra cada material) — esto sucede al inicio, no al completarse.
- **Completed** (Completada) — ingresa la cantidad realmente producida, una **cantidad de desecho/rechazo** (unidades que consumieron material y mano de obra pero no produjeron nada vendible), y el **costo de mano de obra** de la corrida. Sarang agrega la cantidad producida al stock del producto terminado y recalcula su costo promedio a partir del costo de material más el costo de mano de obra, dividido solo entre las unidades producidas buenas — el costo de las unidades desechadas se absorbe en el costo de las unidades buenas, ya que igualmente consumieron recursos reales.
- **Cancelled** (Cancelada) — disponible desde Draft o In Progress, con un motivo opcional. Cancelar una orden que ya consumió materias primas las devuelve al stock.

Cada orden de producción también puede llevar una lista de verificación opcional de **pasos de orden de trabajo** (p. ej. "Mezclado", "Horneado", "Empaquetado") que usted marca uno por uno a medida que la producción realmente sucede en la planta. Marque un paso como **punto de control de calidad** y Sarang exigirá un resultado real de Aprobado/Rechazado antes de poder marcarlo — un control de calidad no puede omitirse silenciosamente con una simple marca.

## 4. Seguimiento de Despacho

Una vez que un producto está terminado y en stock, **Dispatch** registra su salida: elija el producto, una cantidad y opcionalmente un cliente y destino. Un registro de despacho comienza como **Ready** (Listo), pasa a **Dispatched** (Despachado) (este es el punto en que Sarang realmente deduce la cantidad del inventario de productos terminados — no al crearse), y finalmente **Delivered** (Entregado). Crear un registro de despacho verifica que exista suficiente stock terminado antes de dejarlo continuar.

## 5. Productos Terminados

**Finished Goods** lista cada producto que tiene una LDM definida para él — en otras palabras, todo lo que usted realmente fabrica en lugar de simplemente revender. Para cada uno puede ver el stock actual, el precio de venta, y consultar su **historial de producción** completo (cada orden de producción que alguna vez lo produjo, cantidad planificada vs. producida, y estado).

## 6. Gestión de Proveedores

Esta pantalla es su directorio de proveedores de materia prima: cada proveedor activo que tiene al menos un material vinculado a él, con datos de contacto, saldo pendiente, y un desglose de exactamente qué materiales le compra (con el stock actual de cada material, su indicador de stock bajo y su costo unitario). Reutiliza los mismos registros de Proveedor que el resto de Sarang — no hay una lista separada de "proveedor de fabricación" que mantener.

## 7. Análisis de Producción

Un panel de su actividad de fabricación: conteo de órdenes por estado (Draft / In Progress / Completed / Cancelled), su **tasa de rendimiento** general (total producido ÷ total planificado en órdenes completadas), el costo total de material gastado, y una tabla de órdenes completadas recientemente que muestra el porcentaje de rendimiento por orden y el costo por unidad — útil para detectar qué productos producen consistentemente menos de lo planeado o cuestan más de lo esperado.
