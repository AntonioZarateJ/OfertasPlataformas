# Privacidad y atención de solicitudes

## Antes del lanzamiento público

Completar `legal-config.cjs`: nombre o razón social real del responsable, correo público que se supervise, país y domicilio válido para asuntos de privacidad. El nombre comercial RadarPlay no identifica por sí solo a una persona responsable. No inventar una dirección ni publicar una dirección particular por comodidad: elegir el domicilio que legalmente corresponda y revisar su uso. Si se opera desde México, el artículo 15 de la LFPDPPP contempla identidad y domicilio, datos, finalidades, límites de uso, derechos ARCO y cambios al aviso.

Las páginas `/privacidad`, `/contacto` y `/eliminar-datos` permanecen marcadas como borrador y noindex si falta alguno de los datos requeridos. El correo se valida; no se publica un enlace de envío con datos incompletos. Completar los campos quita el rótulo, pero no equivale a una certificación de cumplimiento legal.

Revisar también: plazos de retención reales de Render/Google y respaldos habilitados, obligaciones aplicables según los países de operación y audiencia, identidad del responsable y dirección de contacto, atención a menores y finalidad del servicio, y capacidad para atender solicitudes dentro de los plazos aplicables. El texto base no debe prometer plazos ni procedimientos que el operador no pueda cumplir.

## Datos y ubicaciones revisadas

- Firebase Authentication: correo, UID, nombre, avatar, verificación y credenciales gestionadas por el proveedor.
- Firestore: `users/{uid}/data/wishlist`, con favoritos y metas.
- Navegador: claves de invitado y `steampulse_user_{uid}`, región, almacenamiento de sesión y App Check del SDK. Cerrar sesión no borra todas las copias.
- Render/proveedores: datos técnicos y registros sujetos a sus configuraciones y políticas. Inventariar respaldos antes de responder a una eliminación.
- Historial de precios: datos de productos, no debe usarse para copiar correos o perfiles.
- Correo de soporte: será una nueva ubicación de datos de solicitudes. Mantener acceso limitado y definir cuánto tiempo conservar justificantes y respuestas.

## Procedimiento manual de eliminación de cuenta

No se implementó un borrado automático ni un formulario que envíe correos. Los enlaces mailto solo abren el cliente de correo. El responsable debe atender el buzón.

1. Recibir la solicitud, registrar fecha y alcance en un registro privado, y confirmar la recepción. No pedir contraseña ni códigos de acceso. Verificar razonablemente la titularidad, comprobando el correo de la cuenta y la confirmación del solicitante; no actuar solo porque un tercero conoce un UID. Si hay dudas de suplantación, resolverlas antes de borrar. No solicitar documentación excesiva por defecto.
2. Localizar el usuario exacto en Authentication y su UID. Comprobar que coincide con el documento Firestore. Determinar si pide eliminar un favorito, sus datos o la cuenta completa.
3. Para eliminación completa, deshabilitar la cuenta para impedir nuevas sesiones y renovación de tokens. Los ID tokens ya emitidos duran aproximadamente una hora: con las reglas actuales no existe comprobación adicional de revocación. Esperar a que expire ese periodo (con margen) antes de la eliminación final, o implementar un control de revocación adecuado. No afirmar que deshabilitar una cuenta invalida instantáneamente todos sus ID tokens.
4. En Firestore eliminar específicamente `users/{uid}/data/wishlist`, y cualquier otro documento de ese UID si se añadió posteriormente. Verificar subcolecciones: borrar solo el documento padre no garantiza su eliminación. No borrar la colección global `users` ni datos de otras cuentas.
5. Eliminar el usuario exacto en Authentication. Eliminar Authentication no borra automáticamente Firestore. Comprobar ambas ubicaciones y atender los respaldos/logs conforme a las políticas y obligaciones reales.
6. Confirmar al solicitante el alcance y las excepciones justificadas. Indicar que borre los datos del sitio en sus dispositivos; no prometer borrado remoto de todas las copias locales ni de cuentas en tiendas externas. Evitar conservar innecesariamente una copia de los datos eliminados en correos o exportaciones.

Probar este procedimiento primero con una cuenta creada para ese fin y autorización de su titular, nunca con la cuenta principal. No se ha ejecutado ninguna eliminación durante esta implementación.

## Monetización posterior

El aviso sí aplica a este proyecto. Antes de introducir AdSense u otros anuncios: revisar sus condiciones y aprobación, añadir los tratamientos publicitarios reales al aviso, preparar consentimiento donde corresponda (incluida CMP certificada por Google cuando aplique), revisar CSP, posiciones y rendimiento, y `ads.txt` según la cuenta aprobada. No afirmar que ya hay anuncios, ni que añadir el aviso garantiza aprobación o ingresos.

Referencias: [LFPDPPP vigente](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), [políticas de Google para editores](https://support.google.com/adsense/answer/10502938), [sesiones de Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions), [borrado de Firestore](https://firebase.google.com/docs/firestore/manage-data/delete-data).
