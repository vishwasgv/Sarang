# Copia de Seguridad y Restauración

Sarang almacena todos los datos de su negocio en un único archivo de base de datos local en esta computadora. La pantalla de **Copia de Seguridad** (barra lateral, o **Configuración → Copia de Seguridad y Recuperación**) es donde protege esos datos contra una falla de disco, una eliminación accidental o una máquina perdida o robada.

## Crear una copia de seguridad manual

Haga clic en **Crear Copia de Seguridad**. Sarang ejecuta primero una verificación de integridad de la base de datos, vuelca cualquier escritura pendiente, luego produce una copia limpia y desfragmentada de su base de datos, la verifica con una suma de comprobación y la empaqueta (junto con un pequeño archivo de metadatos) en un único archivo `.sarang-backup`. Si la verificación de integridad falla, la copia de seguridad se rechaza en lugar de guardar una copia posiblemente corrupta — verá un error que explica por qué.

Cada copia de seguridad aparece en la lista de **Historial de Copias** con su nombre de archivo, fecha, tamaño y una insignia de estado válido/inválido.

## Dónde se almacenan las copias de seguridad

Por defecto, las copias de seguridad se guardan en la propia carpeta de datos de esta aplicación, en el mismo disco que su base de datos activa (se muestra en la parte inferior de la pantalla de Copia de Seguridad, y típicamente bajo `AppData\Sarang Business OS Lite\backups\` en Windows). Debido a que es el mismo disco donde vive su base de datos activa, una falla de disco también afectaría las copias de seguridad.

La primera vez que inicia sesión, Sarang muestra un aviso único de **"Mantenga seguras sus copias de seguridad"** animándolo a elegir una ubicación de copia de seguridad diferente — una unidad USB externa, un segundo disco o una carpeta de red — de inmediato. Puede omitirlo y cambiar esto en cualquier momento después desde el botón **Elegir una Carpeta de Copia de Seguridad** de la pantalla de Copia de Seguridad (una configuración solo para propietario/administrador). Si la carpeta configurada se vuelve inaccesible (p. ej. una unidad USB no está conectada), Sarang recurre automáticamente a la carpeta local predeterminada para esa copia de seguridad en lugar de fallar en silencio, y lo señala en pantalla. Las copias de seguridad siempre se guardan en un disco local o carpeta de red que usted elija — nunca en ningún servicio en la nube.

## Copias de seguridad automáticas

Un administrador puede activar la **copia de seguridad automática** desde la pantalla de Copia de Seguridad: actívela, luego configure cuántos días entre copias de seguridad automáticas, cuántas copias de seguridad conservar (las más antiguas más allá de esta cantidad se eliminan automáticamente) y cuántos días sin copia de seguridad deben activar un recordatorio. Cuando está activada, Sarang verifica al iniciar la aplicación si han pasado suficientes días desde la última copia de seguridad y crea una automáticamente si es así, con una notificación que confirma que sucedió.

Sarang también crea una **copia de seguridad de resguardo** automática de su base de datos actual inmediatamente antes de realizar cualquier restauración (vea más abajo), de modo que una restauración se pueda deshacer si es necesario.

## Verificar la integridad de la copia de seguridad y la base de datos

La pantalla de Copia de Seguridad muestra dos indicadores en vivo:
- **Salud de la copia de seguridad** — si está protegido (respaldado hoy), atrasado (respaldado dentro de la última semana pero no hoy), o desprotegido (sin copia de seguridad, o con más de una semana de antigüedad).
- **Integridad de la base de datos** — una verificación de que su archivo de base de datos activo no está corrupto.

También puede hacer clic en el ícono de escudo junto a cualquier copia de seguridad individual para **Verificarla** a demanda — Sarang vuelve a comprobar la suma de verificación del archivo y confirma que todavía se puede abrir y leer correctamente, y actualiza su estado válido/inválido en consecuencia. Cada copia de seguridad tiene una suma de comprobación (SHA-256) al momento de su creación, específicamente para que se pueda detectar una manipulación o corrupción posterior del archivo.

## Restaurar desde una copia de seguridad

Haga clic en el ícono de restaurar en cualquier copia de seguridad de la lista. Sarang primero valida el archivo y le muestra una vista previa — nombre del negocio, fecha de la copia de seguridad, versión de la app y tamaño de la base de datos — para que pueda confirmar que está restaurando la correcta. Confirmar activa lo siguiente:

1. Una copia de seguridad de resguardo de su base de datos *actual* (para que los datos de hoy no se pierdan si cambia de opinión).
2. El reemplazo de la base de datos activa con el contenido de la copia de seguridad.
3. Un reinicio automático de la aplicación para reconectarse a los datos restaurados.

Restaurar solo está disponible para usuarios con el permiso adecuado (típicamente un administrador). Si una restauración falla a mitad de camino, Sarang intenta reconectarse a su base de datos original e informa el error — la copia de seguridad de resguardo creada en el paso 1 existe específicamente para que también pueda recuperarse de esa situación.

## Eliminar copias de seguridad antiguas

Las copias de seguridad se pueden eliminar individualmente desde la lista (restringido por permiso/administrador). Eliminar quita tanto el archivo como su registro; no afecta sus datos activos.
