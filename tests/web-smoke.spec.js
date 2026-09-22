const { test, expect } = require('@playwright/test');

const internalSections = ['#inicio','#como','#restaurante','#retail','#panel-emprendedor','#pro','#beta','#nosotros','#faq','#facturacion','#planes','#descarga','#confianza'];

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`JS: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  return errors;
}

test('principal carga sin errores graves y secciones internas existen', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/index.html');
  await expect(page).toHaveTitle(/PUNTO YA CR/i);
  for (const hash of internalSections) await expect(page.locator(hash)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('todos los enlaces de la principal tienen destino real', async ({ page }) => {
  await page.goto('/index.html');
  const links = await page.locator('a').evaluateAll(as => as.map(a => ({text:(a.textContent||'').trim(), href:a.getAttribute('href')})));
  const bad = links.filter(x => !x.href || x.href.trim()==='#' || /^javascript:/i.test(x.href));
  expect(bad, `Enlaces vacíos/decorativos: ${JSON.stringify(bad)}`).toEqual([]);
});

test('acceso público responde en escritorio y móvil', async ({ page }) => {
  await page.goto('/index.html');
  const login = page.getByRole('link', {name:/Iniciar sesión/i}).or(page.getByRole('button',{name:/Iniciar sesión/i})).first();
  await expect(login).toBeVisible();
  await login.click();
  await expect(page).toHaveURL(/panel\.html\?access=login/);
  await page.goto('/index.html');
  const create = page.getByRole('link', {name:/Crear mi negocio gratis/i}).or(page.getByRole('button',{name:/Crear mi negocio gratis/i})).first();
  await expect(create).toBeVisible();
  await create.click();
  await expect(page).toHaveURL(/panel\.html\?access=create/);
});

test('panel access=login abre el inicio de sesión', async ({ page }) => {
  await page.goto('/panel.html?access=login');
  await expect(page.getByRole('heading',{name:/Iniciar sesión/i})).toBeVisible();
  await expect(page.getByLabel(/Correo/i)).toBeVisible();
});

test('privacidad, términos y 404 cargan', async ({ page }) => {
  await page.goto('/privacidad.html');
  await expect(page.getByRole('heading', {name:/Política de Privacidad/i})).toBeVisible();
  await page.goto('/terminos.html');
  await expect(page.getByRole('heading', {name:/Términos de uso/i})).toBeVisible();
  await page.goto('/404.html');
  await expect(page.getByRole('heading', {name:/Página no encontrada/i})).toBeVisible();
});

test('planes muestran precios aprobados e impuestos incluidos', async ({ page }) => {
  await page.goto('/index.html');
  const body = await page.locator('body').innerText();
  expect(body).toContain('₡6.990'); expect(body).toContain('₡18.900'); expect(body).toContain('₡69.900');
  expect(body.toLowerCase()).toContain('impuestos incluidos');
});

test('no hay desbordamiento horizontal serio en móvil', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'Solo móvil');
  await page.goto('/index.html');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('panel y super admin cargan sus shells sin sesión', async ({ page }) => {
  await page.goto('/panel.html'); await expect(page.locator('body')).toContainText(/PUNTO YA CR/i);
  await page.goto('/admin.html'); await expect(page.locator('body')).toContainText(/PUNTO YA CR/i);
});
