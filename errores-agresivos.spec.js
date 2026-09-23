const { test, expect } = require('@playwright/test');

const PUBLIC_PAGES = ['/index.html','/panel.html','/admin.html','/privacidad.html','/terminos.html'];

function watch(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`JS: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });
  page.on('response', r => {
    if (r.status() >= 400 && !/favicon/i.test(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return errors;
}

test('páginas públicas no producen errores JS/HTTP graves', async ({ page }) => {
  for (const path of PUBLIC_PAGES) {
    const errors = watch(page);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    expect(errors, `${path}: ${errors.join('\n')}`).toEqual([]);
  }
});

test('enlaces internos y archivos locales no terminan en 404', async ({ page, request }) => {
  await page.goto('/index.html');
  const urls = await page.locator('a[href], img[src], script[src], link[href]').evaluateAll(nodes =>
    [...new Set(nodes.map(n => n.getAttribute('href') || n.getAttribute('src')).filter(Boolean))]
  );
  const local = urls.filter(u => !/^(https?:|mailto:|tel:|#|data:)/i.test(u));
  const bad = [];
  for (const u of local) {
    const clean = u.split('#')[0];
    if (!clean) continue;
    const res = await request.get(clean.startsWith('/') ? clean : `/${clean}`);
    if (res.status() >= 400) bad.push(`${res.status()} ${u}`);
  }
  expect(bad).toEqual([]);
});

test('no hay controles visibles sin nombre accesible', async ({ page }) => {
  await page.goto('/index.html');
  const bad = await page.locator('button:visible, a:visible, input:visible, select:visible, textarea:visible').evaluateAll(nodes =>
    nodes.map((el, i) => ({
      i,
      tag: el.tagName,
      text: (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '').trim(),
      html: el.outerHTML.slice(0, 180)
    })).filter(x => !x.text)
  );
  expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
});

test('doble clic en CTA de registro no rompe ni duplica navegación', async ({ page }) => {
  await page.goto('/index.html');
  const cta = page.getByRole('link', { name: /Crear mi negocio gratis/i }).or(page.getByRole('button', { name: /Crear mi negocio gratis/i })).first();
  await expect(cta).toBeVisible();
  await cta.dblclick();
  await expect.poll(() => {
    try { return new URL(page.url()).searchParams.get('access'); }
    catch (_) { return null; }
  }).toBe('create');
});

test('atrás, adelante y recarga conservan navegación pública', async ({ page }) => {
  await page.goto('/index.html');
  await page.goto('/privacidad.html');
  await page.goBack();
  await expect(page).toHaveURL(/index\.html/);
  await page.goForward();
  await expect(page).toHaveURL(/privacidad\.html/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Política de Privacidad/i })).toBeVisible();
});

test('formularios públicos toleran vacío, texto largo y caracteres especiales sin error JS', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/index.html');
  const fields = page.locator('input:visible, textarea:visible');
  const count = await fields.count();
  for (let i = 0; i < count; i++) {
    const f = fields.nth(i);
    const type = (await f.getAttribute('type')) || 'text';
    if (['hidden','file','checkbox','radio','submit','button'].includes(type)) continue;
    await f.fill('');
    if (!['number','email','date','time'].includes(type)) await f.fill('Áéñ <> & " \' ' + 'X'.repeat(300));
  }
  expect(errors).toEqual([]);
});

test('layout no se sale horizontalmente en tamaños críticos', async ({ page }) => {
  const sizes = [{w:320,h:568},{w:390,h:844},{w:768,h:1024},{w:1024,h:768},{w:1440,h:900}];
  for (const s of sizes) {
    await page.setViewportSize({ width:s.w, height:s.h });
    await page.goto('/index.html');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflow ${overflow}px en ${s.w}x${s.h}`).toBeLessThanOrEqual(2);
  }
});

test('página principal responde dentro de un límite razonable', async ({ page }) => {
  const start = Date.now();
  await page.goto('/index.html', { waitUntil:'domcontentloaded' });
  const ms = Date.now() - start;
  expect(ms, `DOM tardó ${ms}ms`).toBeLessThan(5000);
});
