# Sastre / Boutique

## Qué incluye

Sastre / Boutique está construido sobre la base compartida de negocio de servicio de Sarang — citas, un catálogo de servicios, horarios de proveedores y la cola de notificaciones — más un único módulo dedicado: **Pedidos de Sastrería**, que cubre tanto el pedido en sí como las medidas corporales guardadas de cada cliente.

## Pedidos

Cada pedido registra el tipo de prenda (Camisa, Pantalón, Traje, Kurta, Salwar Kameez, Blusa, Lehenga, Blusa de Sari, Chaqueta, Otro), género, región de estilo (Indio u Occidental), quién suministró la tela (cliente o tienda) y su descripción, cantidad, precio unitario y anticipo pagado — con el saldo pendiente calculado automáticamente.

Un pedido se puede vincular a uno de los registros de medidas guardados del cliente, y pasa por una tubería de estados: **Recibido → En Corte → En Confección → Prueba Programada → (Ajustes, si es necesario) → Listo → Entregado**, con Cancelado como un resultado separado. Las fechas de prueba y entrega se rastrean por separado, y las entregas atrasadas se marcan en rojo. Una vez en estado Listo, un botón de **Generar Factura** factura el pedido.

## Medidas

La pestaña de **Medidas** mantiene un historial corriente de las medidas corporales de un cliente — pecho, cintura, cadera, hombro, cuello, manga, entrepierna, costura exterior, muslo, altura, sisa, profundidad de cuello delantero/trasero, largo de la prenda y puño — junto con quién tomó la medida y cuándo. Un cliente puede tener más de un registro de medidas a lo largo del tiempo, y cualquiera de ellos se puede adjuntar a un pedido nuevo.

## Idioma

Sastre / Boutique es la **única excepción deliberada** entre las plantillas de negocio de servicio de Sarang: todos los demás tipos de negocio de esta familia funcionan solo en inglés, pero las pantallas de Sastre / Boutique están completamente traducidas y funcionan en los **13 idiomas admitidos por Sarang**, igual que un negocio basado en productos como Minorista o Farmacia. Cambie el idioma de su interfaz desde **Configuración → Idioma** como de costumbre — Pedidos de Sastrería y Medidas lo seguirán.
