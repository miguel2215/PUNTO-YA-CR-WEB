PUNTO YA CR — CIERRE WEB + PANEL

ESTRUCTURA
- public/ = únicamente archivos que Cloudflare debe publicar.
- tests/ = Playwright.
- wrangler.jsonc = Cloudflare Worker de la web.
- package.json = dependencias, pruebas y deploy.

CLOUDFLARE
Deploy command recomendado:
  npx wrangler deploy --config ./wrangler.jsonc

Wrangler publica SOLO ./public, por lo que node_modules, tests y reportes ya no pueden convertirse en assets públicos.

DOMINIO
- https://puntoyacr.com = principal.
- https://www.puntoyacr.com = también conectado.
- El POS continúa temporalmente en el Worker anterior hasta conectar app.puntoyacr.com.

PRUEBAS
npm run test:web       -> batería completa
npm run test:smoke     -> web pública + cierre comercial
npm run test:panel     -> Panel con sesión real
npm run test:security  -> RLS / aislamiento

SEGURIDAD
Las pruebas reales requieren GitHub Secrets. Ver GITHUB-SECRETS-PRUEBAS.txt.

ESTADO COMERCIAL
- Pago online: todavía no conectado; la web lo comunica.
- Android: todavía no publicado; la web lo comunica como próximamente.
- Facturación electrónica: permanece EN PREPARACIÓN.
- Privacidad/Términos: base técnica presente; revisión legal profesional periódica sigue recomendada para validar cambios y cumplimiento aplicable.
