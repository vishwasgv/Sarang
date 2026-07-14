# Usuarios y Permisos

Si más de una persona usa Sarang — un propietario más cajeros, personal de cocina o gerentes — agregue a cada uno como su propio **Usuario** con un **Rol** que controla exactamente qué puede ver y hacer. Esto se administra desde **Configuración → Usuarios y Roles**.

## Agregar un usuario

Haga clic en **Agregar Usuario** y complete:

- **Nombre Completo** (obligatorio)
- **Nombre de Usuario** (obligatorio — se usa para iniciar sesión)
- **Contraseña** (obligatoria, longitud mínima según su Política de Contraseñas, al menos 6 caracteres)
- **Rol** (obligatorio — vea más abajo)
- **Correo Electrónico** y **Teléfono** (opcionales)

Guarde, y la nueva cuenta podrá iniciar sesión de inmediato con el nombre de usuario y la contraseña que configuró.

## Roles

Cada usuario tiene asignado un rol, y cada rol viene con un conjunto fijo de permisos integrados en Sarang — no hay una pantalla para crear roles personalizados o elegir permisos individuales a mano. Los roles integrados son:

- **Administrador** — acceso total al sistema, incluyendo cada configuración, cada informe y la propia gestión de usuarios.
- **Gerente** — control operativo amplio (facturación, inventario, compras, informes, la mayoría de las configuraciones) sin acceso total de nivel administrador.
- **Cajero** — enfocado en facturación: crear facturas, registrar pagos y las operaciones diarias de mostrador relevantes para su tipo de negocio.
- **Personal** — soporte operativo general con acceso más limitado que Cajero/Gerente.
- **Personal de Cocina** — limitado a las operaciones de cocina del restaurante (ver/actualizar KOT), para negocios que usan la plantilla de Restaurante.

Cada pantalla y acción en Sarang verifica los permisos del rol del usuario actual antes de permitirla — por ejemplo, la sección de Usuarios y Roles en sí solo es visible para un usuario cuyo rol incluya el permiso `users.view`, y crear, editar o desactivar otros usuarios requiere cada uno su propio permiso independiente. Si su rol no tiene acceso a algo, la opción se oculta o se muestra deshabilitada.

## Editar un usuario o cambiar su rol

Haga clic en el ícono de editar (lápiz) junto a un usuario para cambiar su nombre completo, rol, correo electrónico o teléfono. El nombre de usuario y la contraseña no se cambian desde este formulario — vea el restablecimiento de contraseña más abajo.

## Desactivar un usuario

Haga clic en el ícono de eliminar junto a un usuario activo para desactivarlo (requiere el permiso de desactivación). Una cuenta desactivada ya no puede iniciar sesión, pero sus registros históricos (facturas creadas, acciones registradas, etc.) se conservan. No puede desactivar su propia cuenta desde esta pantalla.

## Restablecer la contraseña de otro usuario

Haga clic en el ícono de escudo junto a un usuario (no disponible para su propia cuenta) para establecerle directamente una nueva contraseña — útil si la olvidó. Esto invalida de inmediato cualquiera de sus sesiones ya iniciadas.

## Cambiar su propia contraseña

Vaya a **Configuración → Seguridad**, ingrese su contraseña actual, luego su nueva contraseña dos veces. Su nueva contraseña debe cumplir con la longitud mínima configurada (10 caracteres por defecto). Después de un cambio exitoso, deberá iniciar sesión de nuevo.

## Política de contraseñas

También bajo **Configuración → Seguridad**, un administrador puede establecer la **longitud mínima de contraseña** requerida para toda cuenta de aquí en adelante (entre 4 y 64 caracteres). Esto solo se aplica la próxima vez que se cree o cambie una contraseña — las contraseñas existentes no se ven afectadas retroactivamente.

## Tiempo de espera de sesión

Por seguridad, Sarang cierra automáticamente la sesión de un usuario inactivo después de un período sin actividad (30 minutos por defecto) — cualquier clic del mouse, pulsación de tecla, desplazamiento o toque reinicia el temporizador. Esto protege contra que alguien se aleje de una caja registradora o computadora de oficina desbloqueada. Volver a iniciar sesión simplemente requiere su nombre de usuario y contraseña de nuevo; no se pierde ningún trabajo en curso más allá de lo que aún no se había guardado.

## Protección de inicio de sesión

Después de 5 intentos fallidos de inicio de sesión para el mismo nombre de usuario dentro de 15 minutos, Sarang bloquea temporalmente más intentos y le indica cuántos minutos debe esperar — esto se aplica tanto al iniciar sesión como al cambiar su propia contraseña, para frenar a cualquiera que intente adivinar una contraseña.
