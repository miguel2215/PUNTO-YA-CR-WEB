# Pruebas nuevas — PUNTO YA CR

## 1. Errores agresivos
`npm run test:aggressive`

Busca errores JS/HTTP, 404 locales, controles sin nombre, doble clic, atrás/adelante/recarga, entradas extrañas, overflow en 320/390/768/1024/1440 y carga lenta.

## 2. Seguridad / Supabase
`npm run test:security`

No usa negocios reales y no borra datos. Para activar las pruebas de aislamiento crea cuentas y negocios EXCLUSIVAMENTE de prueba y agrega estos GitHub Secrets:

- TEST_A_EMAIL / TEST_A_PASSWORD: dueño de Negocio Prueba A
- TEST_B_EMAIL / TEST_B_PASSWORD: dueño de Negocio Prueba B
- TEST_ROLE_EMAIL / TEST_ROLE_PASSWORD: miembro Caja/Cocina no-owner de un negocio de prueba
- SUPABASE_URL y SUPABASE_ANON_KEY son opcionales mientras se use el proyecto actual.

Sin esos Secrets las pruebas peligrosas se omiten, no fallan. La prueba de rol intenta un INSERT mínimo que RLS DEBE rechazar; si lo acepta, el test falla y habrá que revisar las políticas.
