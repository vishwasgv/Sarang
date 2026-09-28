# Guía: usar Sarang en más de un PC

Algunas tiendas necesitan que dos o tres personas trabajen a la vez: una en el mostrador, otra con las compras, otra revisando las cuentas. Sarang puede hacerlo en la red de su propia tienda. Nada sale por internet.

## Cómo funciona

- Un PC guarda todos los datos. Se llama **servidor**. Manténgalo encendido, con Sarang abierto, durante el horario de la tienda.
- Los demás PC son **clientes**. No guardan datos del negocio. Muestran y modifican los datos que guarda el servidor.
- Todo lo que viaja entre los PC va cifrado con un **secreto compartido** que usted elige. Está desactivado hasta que lo active.

## Qué necesita

- Todos los PC en la misma red de la tienda (el mismo Wi-Fi o la misma red por cable).
- Una licencia con suficientes **puestos**. El PC de la tienda cuenta como un puesto, y cada otro PC con sesión iniciada al mismo tiempo usa uno más. Una prueba gratuita permite dos PC para que pueda probarlo. Para añadir puestos, escriba a la dirección que aparece en la pantalla de Licencia.

## Configurar el servidor (el PC que guarda los datos)

1. Inicie sesión como propietario. Vaya a **Settings → Business features → Multi-user**.
2. Elija **Este equipo guarda los datos (servidor)**.
3. Anote la **dirección** que se muestra (por ejemplo 192.168.1.10:47821) y el **secreto compartido**. Puede cambiar el secreto cuando quiera con **Crear un secreto nuevo**.
4. Pulse **Guardar y reiniciar Sarang**.
5. Si otro PC no puede conectarse, permita Sarang en el firewall de Windows de este PC para redes privadas.

## Configurar cada PC cliente

1. Instale Sarang en el PC y ábralo.
2. En la página de inicio de sesión pulse **Conexión entre equipos (varios equipos)**.
3. Elija **Este equipo se conecta a otro equipo (cliente)**. Escriba la dirección del servidor y el secreto compartido, pulse **Probar conexión** y después **Guardar y reiniciar Sarang**.
4. Inicie sesión con su propio usuario y contraseña. Cree un usuario para cada persona en **Settings → Users** para que cada venta y cada cambio muestre quién lo hizo.

## Trabajar juntos

- Cada persona tiene su propio inicio de sesión y sus propios permisos.
- Si dos personas guardan en el mismo instante, una espera un momento a la otra. Números como los de factura nunca se repiten. Si dos personas venden la última unidad, solo una venta se completa.
- Cuando alguien abre un cliente, proveedor o producto para editarlo, los demás que abren el mismo registro ven **"… tiene esto abierto en otro equipo"** y no pueden guardar hasta que lo cierre.
- Cuando otro PC cambia datos, aparece una pequeña nota: **"… cambió algunos datos en otro equipo. Actualizar."** Pulse Actualizar para ver lo último.
- **Settings → Business features → Multi-user** en el servidor muestra quién está conectado y permite desconectar un PC.

## Lo que solo funciona en el PC servidor

Las copias de seguridad y su restauración, la importación de archivos, el tutorial, la activación de la licencia, abrir documentos del disco y la impresión de tickets de cocina se hacen en el PC servidor. Un PC cliente imprime facturas y guarda informes (Excel, PDF, CSV) en su propia impresora y disco.

## Buenos hábitos

- Mantenga el servidor con energía estable y haga una copia de seguridad cada día en el servidor. Los clientes no pueden trabajar si el servidor está apagado.
- No copie el archivo de datos a otros PC ni abra el mismo archivo desde dos PC por la red. Use esta función. Abrir un mismo archivo desde dos PC puede dañarlo.
- Mantenga en privado el secreto compartido. Si alguien deja la tienda, pulse **Crear un secreto nuevo** y escriba el nuevo en los demás PC.
