# Asistente de Importación de Datos

Abra **Importar** desde la barra lateral para cargar en bloque Productos, Clientes, Proveedores, Inventario (stock inicial) o Saldos Iniciales desde un archivo CSV o Excel (.xlsx) — útil al cambiarse a Sarang desde otro sistema o una hoja de cálculo, en lugar de escribir cientos de registros uno por uno.

## Paso 1 — Elegir un módulo

Elija exactamente uno de los cinco tipos de importación: **Productos**, **Clientes**, **Proveedores**, **Inventario** o **Saldos Iniciales**. Cada uno tiene su propia lista de columnas esperadas, que se muestra al continuar.

## Paso 2 — Subir su archivo

Arrastre y suelte un archivo `.csv` o `.xlsx` en la zona de arrastre, o toque **Examinar Archivo** para elegir uno desde un cuadro de diálogo. Si aún no tiene un archivo listo, toque primero **Descargar Plantilla** — genera una hoja de cálculo inicial con los encabezados de columna correctos para el módulo que eligió.

El panel de **Columnas Esperadas** lista cada columna que la importación entiende para este módulo, obtenida en vivo para que nunca quede desactualizada respecto a lo que la aplicación realmente acepta. Un punto rojo y un asterisco marcan una columna como obligatoria; todo lo demás es opcional.

**Advertencia de ceros iniciales**: si alguno de sus valores de SKU, Código de Barras o Teléfono tiene ceros iniciales (como `0012`), formatee esa columna como **Texto** en Excel antes de guardar. Excel elimina en silencio los ceros iniciales de cualquier columna dejada en formato General o Número, y una vez que eso ocurre, el valor original no se puede recuperar — Sarang nunca llega a ver el cero.

## Paso 3 — Asignar columnas

Para cada campo que Sarang espera, elija qué columna de su archivo lo proporciona, usando el menú desplegable junto al nombre de cada campo. Sarang precompleta automáticamente una asignación de mejor estimación al hacer coincidir los nombres de encabezado de su archivo, así que la mayoría de las importaciones solo necesitan una revisión rápida en lugar de asignar cada campo a mano. Un campo solo puede asignarse desde una columna a la vez — elegir una nueva columna para un campo borra automáticamente la columna que tenía asignada antes.

## Paso 4 — Vista previa

Sarang valida las primeras 20 filas de su archivo y muestra cada una como **Válido**, **Duplicado** (se omitirá — ya existe un registro coincidente), o **Error** (se omitirá, con el motivo específico mostrado, como un campo obligatorio faltante o un valor con formato incorrecto). Esto es una muestra, no una validación completa — el resumen indica explícitamente que solo se revisaron las primeras 20 filas, y las filas restantes se validan a medida que se procesan realmente durante la importación, por lo que los conteos finales pueden diferir ligeramente de lo que mostró la vista previa.

## Paso 5 — Confirmar y ejecutar

Antes de que la importación realmente se ejecute, Sarang siempre se asegura de que exista una copia de seguridad de respaldo — reutilizando una de los últimos 15 minutos, o creando una nueva si no existe ninguna. Ninguna importación procede sin esta copia de seguridad en su lugar.

El modo de importación es siempre **Create Only**: una fila cuya clave (SKU, teléfono, nombre — según el módulo) ya coincide con un registro existente se omite, nunca se sobrescribe. Esto hace que sea seguro volver a ejecutar una importación con el mismo archivo sin riesgo de duplicar o corromper datos existentes, pero también significa que corregir un error tipográfico en una fila ya importada requiere editar ese registro directamente después, no volver a importar.

Toque **Ejecutar Importación** para comenzar. Una barra de progreso rastrea las filas procesadas frente al total del archivo mientras se ejecuta.

## Paso 6 — Resultados

Cuando la importación termina, verá exactamente cuántas filas fueron **Importados**, **Omitido** (duplicados), **Fallido** (errores), y cuántas **Advertencias** se generaron en el proceso, además de una lista desplazable de cada error de fila específico si ocurrió alguno. Desde aquí, **Importar Otro Archivo** lo lleva de vuelta al Paso 1 para una nueva importación, o **Completado** cierra el asistente.

## Si algo sale mal

Como siempre se toma primero una copia de seguridad, una importación que sale mal se puede deshacer restaurando esa copia de seguridad desde **Configuración → Copia de Seguridad y Recuperación** — consulte el capítulo Copia de Seguridad y Restauración de este Manual.
