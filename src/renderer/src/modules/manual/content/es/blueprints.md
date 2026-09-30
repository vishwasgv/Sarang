# Planos: Seguimiento de Etapas de Documentos

## Qué es

Los **Planos** le permiten definir una serie de etapas con nombre por las que un documento pasa visiblemente — por ejemplo **Borrador → Aprobado → Enviado al proveedor → Recibido** para una Orden de Compra, o sus propias palabras para una Orden de Venta. Es una forma simple y visual de ver *dónde está realmente* un documento en su propio proceso, más allá de su estado del sistema (Borrador, Confirmada, Facturada, etc.).

Los Planos actualmente se aplican a dos tipos de documento: **Órdenes de Compra** y **Órdenes de Venta**. Cada tipo de documento tiene su propio conjunto de etapas, independiente del otro — la secuencia que configure para las Órdenes de Compra no afecta en nada a las Órdenes de Venta, y viceversa.

Al igual que los Flujos de Aprobación, los Planos vienen **desactivados por defecto** y son totalmente **opcionales**. Si nunca configura ninguna etapa para un tipo de documento, no cambia nada en ningún lugar — no aparece ningún widget, y el documento funciona exactamente como siempre.

## Configurar las etapas (Configuración)

Un propietario o administrador configura las etapas desde **Configuración**, en la sección de Planos. Elija el tipo de documento (Orden de Venta u Orden de Compra), luego agregue etapas una por una escribiendo un nombre y confirmando — cada nueva etapa se añade al final de la secuencia.

Hay algunos límites reales que debe conocer:

- **Hasta 20 etapas** por tipo de documento. Si llegó al límite, retire una etapa que ya no necesite antes de agregar una nueva.
- **No se permiten nombres duplicados** dentro del mismo tipo de documento — esto se comprueba sin distinguir entre mayúsculas y minúsculas.
- El nombre de una etapa puede tener hasta **80 caracteres**.
- Use los controles de subir/bajar junto a cada etapa para **reordenar** la secuencia en cualquier momento — esto solo cambia el orden en que se muestran las etapas; no afecta a ningún documento que ya esté en una de ellas.
- Quitar una etapa de la lista no la borra permanentemente, sino que la **retira**. Esto importa porque un documento real puede estar ya en esa etapa; retirarla conserva ese historial intacto mientras deja de estar disponible para uso nuevo. Una etapa retirada ya no aparece en la secuencia ni como opción para avanzar un documento.

Configurar las etapas (agregar, reordenar, retirar) requiere el mismo permiso que cambiar el resto de la configuración del negocio. Quien solo pueda ver la Configuración podrá ver las etapas configuradas, pero no cambiarlas.

## Ver y avanzar la etapa de un documento

Una vez que un tipo de documento tiene al menos una etapa configurada, cada documento de ese tipo muestra un seguimiento de etapas directamente en su propia pantalla de detalle — en las pantallas de detalle tanto de **Órdenes de Compra** como de **Órdenes de Venta**, junto al panel de aprobación de ese documento (si tiene uno configurado). El seguimiento muestra toda la secuencia como una fila de etapas; la etapa actual del documento aparece resaltada, y las etapas anteriores a ella se marcan como completadas.

Un documento que aún no se ha movido se considera automáticamente en la **primera etapa** — al activar los Planos para un tipo de documento, no necesita volver a sus documentos existentes para asignarles una etapa inicial; hasta que alguien los avance, simplemente se consideran en la primera etapa.

Para avanzar un documento, haga clic directamente en la etapa a la que quiere moverlo — **no** es necesario pasar por las etapas una por una en orden; se puede seleccionar directamente cualquier etapa configurada. Hacer clic en la etapa en la que el documento ya se encuentra no hace nada.

## Esto no es una condición de aprobación

Los Planos son una secuencia de estado que usted define libremente para su propio seguimiento — **no** son un control de aprobación ni de permisos. Mover un documento de una etapa a la siguiente solo requiere el mismo permiso que ya permite crear o editar ese tipo de documento; no existe una configuración separada de "quién puede avanzar una etapa", y ninguna etapa puede bloquear o exigir aprobación antes de que un documento avance. Si necesita que un documento requiera una firma de aprobación por encima de cierto monto antes de confirmarse, para eso están los **Flujos de Aprobación** — los Planos y los Flujos de Aprobación pueden usarse juntos en el mismo documento, pero cumplen funciones distintas: los Flujos de Aprobación controlan si un documento *puede* confirmarse; los Planos solo muestran *dónde está* después, dentro de la secuencia que usted diseñó.

## Si un tipo de documento no tiene etapas configuradas

Si no ha configurado ninguna etapa para las Órdenes de Compra o de Venta, el seguimiento de etapas simplemente no aparece en las pantallas de esos documentos — no hay nada que desactivar u ocultar por separado. Configurar la primera etapa para un tipo de documento es lo único necesario para que el seguimiento aparezca en cada documento de ese tipo a partir de entonces.
