# Registro de Auditoría

El **Registro de Auditoría** (barra lateral) es un registro permanente de las acciones significativas realizadas en Sarang — quién hizo qué, y cuándo. Existe para que siempre pueda responder "¿quién cambió esto?" o "¿quién inició sesión y cuándo?", y para ayudar a detectar cualquier cosa inusual.

## Qué se registra

Sarang registra una entrada de auditoría para acciones en toda la aplicación, incluyendo (entre muchas otras): inicios de sesión, cierres de sesión e intentos fallidos de inicio de sesión; cambios de contraseña; creación y cancelación de facturas; pagos registrados y revertidos; stock agregado o ajustado; copias de seguridad creadas, restauradas o eliminadas; y cambios en la configuración del negocio. Cada entrada muestra la fecha y hora, la acción (p. ej. "FACTURA CREADA", "PAGO REVERTIDO"), la entidad afectada (p. ej. qué Factura o Producto) y qué usuario la realizó — o "Sistema" si no estaba vinculada a un usuario específico con sesión iniciada.

## Ver y filtrar el registro

La pantalla de Registro de Auditoría lista las entradas de más reciente a más antigua, 50 por página, con controles de página **Anterior/Siguiente**. Use el menú desplegable de tipo de entidad en la parte superior para filtrar a un tipo específico de registro (Usuario, Factura, Pago, Inventario, Producto, Cliente, Copia de Seguridad, y muchos más tipos de entidad específicos del negocio). Haga clic en **Ver** en cualquier fila que tenga detalles registrados para expandirla y ver los valores anteriores y nuevos involucrados en esa acción (mostrados como datos legibles, no como código en bruto).

Las entradas muy antiguas se eliminan automáticamente después de un período de retención configurable (2 años por defecto), de modo que el registro no crezca para siempre — esto solo elimina historial genuinamente antiguo, no nada reciente.

## Verificar que su historial de auditoría no haya sido manipulado

Haga clic en **Verificar Integridad** en la parte superior de la pantalla de Registro de Auditoría. Sarang puede verificar que todo su historial de auditoría no haya sido manipulado — cada entrada está secretamente enlazada a la anterior cuando se crea, de modo que si alguien alguna vez pudiera entrar y editar o eliminar silenciosamente una entrada pasada (por ejemplo, para ocultar que una factura cancelada en realidad ocurrió, o para borrar un ajuste de stock sospechoso), ese enlace se rompería y Sarang lo detectaría.

Ejecutar la verificación le indica una de dos cosas:
- **La cadena está intacta** — mostrando cuántas entradas se verificaron, confirmando que nada en su historial registrado ha sido alterado.
- **La cadena está rota** — señalando aproximadamente dónde se encontró la ruptura, para que sepa que algo en su rastro de auditoría no coincide con lo que debería.

Esta verificación se ejecuta a demanda (no es automática en cada inicio de la aplicación, ya que verificar un historial grande es un trabajo real) — ejecútela cuando quiera tener la seguridad de que sus registros son confiables, por ejemplo antes de basarse en el registro de auditoría para resolver una disputa.
