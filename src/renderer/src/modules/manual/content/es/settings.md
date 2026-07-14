# Configuración y Perfil del Negocio

Todo lo que define cómo se comporta Sarang para su negocio vive bajo **Configuración**, a la que se llega desde la barra lateral. La pantalla de Configuración tiene su propio menú lateral de secciones — haga clic en cualquiera para abrirla.

## Perfil del Negocio

**Configuración → Perfil del Negocio** contiene los datos que se imprimen en cada factura y recibo: nombre del negocio, nombre del propietario, teléfono, correo electrónico, número de GST/IVA, ID de UPI, sitio web y dirección completa (dirección, ciudad, estado, código postal). También puede subir un logo del negocio (JPG, PNG o WebP, menor a 2MB) y elegir si se muestra en el Panel y/o como una marca de agua tenue en los documentos impresos.

Si su tipo de negocio es **Clínica Especialista**, aparece un campo adicional de **Especialidad** (por ejemplo, Pediatría, Ortopedia, Otorrinolaringología). Haga clic en **Editar** para cambiar cualquiera de estos campos, luego **Guardar Cambios**. El país, la moneda y el modelo de impuesto se muestran aquí como referencia, pero se cambian desde las secciones **Moneda y Región** y **Configuración de Impuestos**, respectivamente.

## Configuración de Impuestos

**Configuración → Configuración de Impuestos** administra las tasas de GST/IVA/impuesto sobre ventas disponibles al facturar. Agregue un impuesto con un nombre (p. ej. "GST 18%"), un tipo (GST, IVA, Impuesto sobre Ventas, Personalizado o Ninguno), una tasa entre 0-100%, y opcionalmente un país y una marca de "predeterminado para este tipo de impuesto". Las facturas existentes nunca se ven afectadas cuando edita o elimina una tasa de impuesto — eliminarla solo la desactiva de ahí en adelante.

## Moneda y Región

**Configuración → Moneda y Región** establece su moneda (Sarang admite aproximadamente 150 monedas mundiales), su formato de número (agrupación india como 1,00,000.00, EE. UU./Internacional, Europea, Británica, Árabe o Indonesia) y decimales (0, 2 o 3). Una vista previa en vivo muestra exactamente cómo se formateará un monto antes de guardar.

## Tipo de Negocio

**Configuración → Tipo de Negocio** es donde elige su tipo de negocio — Restaurante, Minorista, Farmacia, Ferretería, Distribuidor, Hotel/Posada, Joyería, Fabricación, uno de los tipos de servicio profesional (Abogado, Arquitecto, Firma de CA, y muchos más), y así sucesivamente. Cada plantilla activa un conjunto específico de módulos de función — por ejemplo, Restaurante activa la Gestión de Mesas, la impresión de KOT y el seguimiento de recetas/ingredientes, mientras que Farmacia activa el seguimiento de lotes y caducidad. La pantalla muestra la lista exacta de módulos bajo cada opción, para que sepa exactamente qué está obteniendo.

Cambiar de plantilla cambia de inmediato su navegación de barra lateral y su conjunto de funciones — sin necesidad de reiniciar — y **todos los datos existentes se conservan**, solo cambia qué funciones son visibles. Como esta es una elección de selección única, cambiar a una nueva plantilla reemplaza su conjunto de módulos actual en lugar de agregarse a él (una tienda Minorista que cambia a Distribuidor pierde el módulo de Devoluciones específico de Minorista, a menos que también se active por separado — vea más abajo).

## Funciones Adicionales de Negocio

**Configuración → Funciones Adicionales de Negocio** le permite añadir módulos de función de otros tipos de negocio, encima de lo que ya le da su Tipo de Negocio — útil si su negocio genuinamente abarca más de un tipo (p. ej. una tienda minorista que también hace comercio mayorista/de distribuidor). Estos interruptores son independientes de su Tipo de Negocio y se pueden activar o desactivar en cualquier momento:

- **Flujo de Devoluciones** — acepte devoluciones de productos con reversión automática de inventario y libro contable.
- **Calculadora de Precio por Área** — precio por área (pies²/m²), útil para vidrio, madera contrachapada o baldosas.
- **Aplicación de Límite de Crédito** — bloquea una nueva venta a crédito una vez que el saldo pendiente de un cliente superaría su límite de crédito establecido. Solo afecta a los clientes que realmente tienen un límite de crédito configurado; los clientes ocasionales tienen por defecto sin límite y nunca son bloqueados.
- **Flujo de Pedidos al por Mayor** — una pantalla separada de pedidos al por mayor con niveles de descuento basados en volumen para clientes mayoristas/distribuidores.
- **Análisis de Saldos Pendientes** — informes adicionales sobre los saldos pendientes de clientes y su antigüedad.
- **Logística y Cadena de Suministro** — un paquete que cubre flota, transportistas, envíos, recepción de mercancía (GRN), albaranes de entrega y seguimiento de fletes, para cualquier negocio que mueva mercancía con sus propios vehículos o quiera rastrear formalmente las entregas de proveedores.

Dos funciones transversales más tienen sus propias secciones dedicadas de Configuración en lugar de vivir en esta lista: **Código de Barras y Facturación Suelta** y **AI Assistant** (vea más abajo, y sus propios capítulos del manual). Desactivar cualquiera de estas funciones no elimina los datos existentes — solo oculta las pantallas y flujos de trabajo relacionados.

## Código de Barras y Facturación Suelta

**Configuración → Código de Barras y Facturación Suelta** es donde opta por la generación de códigos de barras, la impresión de etiquetas de código de barras y la facturación suelta/por peso. Las tres están desactivadas por defecto para todo tipo de negocio. Consulte el capítulo *Código de Barras y Facturación Suelta/por Peso* para conocer todos los detalles sobre su uso una vez activadas.

## AI Assistant

**Configuración → AI Assistant** activa **Ask Sarang**, un asistente de preguntas y respuestas sin conexión sobre los datos de su propio negocio. Desactivado por defecto. Consulte el capítulo *Ask Sarang (AI Assistant)* para saber qué puede responder.

## Idioma

**Configuración → Idioma** admite 13 idiomas: Inglés, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Gujarati, Español, Francés, Árabe, Portugués e Indonesio. Los idiomas están agrupados en listas de **Globales** e **Idiomas de la India**. Seleccionar un idioma cambia la interfaz de inmediato — sin necesidad de reiniciar. Elegir Árabe también cambia toda la interfaz automáticamente a un diseño de derecha a izquierda.

## Apariencia

**Configuración → Apariencia** tiene dos controles:

- **Modo Oscuro** — un interruptor para un esquema de colores oscuro.
- **Tipo de Impresión** — elija entre **Factura A4** (página completa, a color), **Térmica 80mm** (ancho de recibo POS estándar) o **Térmica 58mm** (ancho de recibo POS angosto). Esto determina el formato usado cada vez que imprime una factura o recibo.

Ambas preferencias se guardan automáticamente y se recuerdan la próxima vez que abra Sarang.

## Usuarios y Roles, Seguridad, y Copia de Seguridad

Tres secciones más viven en este mismo menú de Configuración pero se cubren en sus propios capítulos: **Usuarios y Roles** (vea *Usuarios y Permisos*), **Seguridad** — donde cambia su propia contraseña (vea *Usuarios y Permisos*), y **Copia de Seguridad y Recuperación**, que abre la pantalla dedicada de Copia de Seguridad (vea *Copia de Seguridad y Restauración*).

## Acerca de

**Configuración → Acerca de** muestra su número de versión instalado y la declaración de transparencia de Sarang (qué datos se recopilan y cuáles no — ninguno, ya que Sarang es completamente sin conexión).
