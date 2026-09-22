PUNTO YA CR — WEB + PANEL DEL EMPRENDEDOR · PRODUCCIÓN 2026

Esta versión integra la web comercial, Panel del Emprendedor, Super Admin y pruebas Playwright.

WEB PÚBLICA
- Inicio, Restaurante, Retail, Panel del Emprendedor, PRO, Programa Fundadores, Sobre nosotros, FAQ y Facturación en preparación.
- Precios finales: ₡6.990 mensual · ₡18.900 trimestral · ₡69.900 anual.
- Texto visible: impuestos incluidos.
- Login y crear negocio disponibles también en móvil.
- Privacidad, Términos y 404 incluidos.
- Newsletter conectado a Supabase.
- Pagos online y Android permanecen marcados como pendientes hasta conectar la pasarela/APK oficiales.

PANEL DEL EMPRENDEDOR
- FREE / PRO.
- Resumen, Ventas, Dinero, Crecimiento y Contabilidad.
- Gastos, proveedores, facturas, abonos, metas, simulador y Mi contador.
- Logo del negocio mediante Supabase Storage.
- Activación PRO mediante código.
- Cierre de sesión por 30 minutos de inactividad.
- Acceso privado al Super Admin si Supabase confirma platform_admins.

SUPER ADMIN
- Negocios, suscripciones, códigos PRO, Programa Fundadores y newsletter.
- El acceso real depende de funciones/RLS de Supabase.

PRUEBAS
- Smoke público.
- Pruebas agresivas y responsive.
- Panel público.
- Aislamiento Supabase A/B y rol no-owner (requiere GitHub Secrets de cuentas de prueba).

IMPORTANTE
- No se incluyen claves privadas/service_role.
- No se incluye SQL dentro del ZIP.
- El dominio actual del POS todavía apunta a https://mipuntocr.mieduar2215.workers.dev/ hasta que se defina/publice el dominio definitivo de PUNTO YA CR.
- La facturación electrónica 4.4 y la pasarela de pago real siguen siendo integraciones externas pendientes.
