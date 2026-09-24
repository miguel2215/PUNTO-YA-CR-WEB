const { test, expect } = require('@playwright/test');

test('cierre comercial: dominio, marca y estados públicos correctos', async ({ page }) => {
  await page.goto('/index.html');

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', 'https://puntoyacr.com/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://puntoyacr.com/');

  const body = await page.locator('body').innerText();
  expect(body).toContain('PUNTO YA CR');
  expect(body).not.toMatch(/Mi Punto CR/i);
  expect(body).toMatch(/Facturación electrónica/i);
  expect(body).toMatch(/EN PREPARACIÓN/i);
  expect(body).toMatch(/Pagos web procesados mediante Tilopay/i);
  expect(body).not.toMatch(/pagos en línea estarán disponibles|cuando conectemos la pasarela/i);
  expect(body).toMatch(/Android[\s\S]{0,120}PRÓXIMAMENTE/i);
  expect(body).not.toMatch(/Descargar para Android/i);
});

test('cierre comercial: panel y admin no deben indexarse', async ({ page }) => {
  await page.goto('/panel.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
  await page.goto('/admin.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
});

test('robots y sitemap existen', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('Sitemap: https://puntoyacr.com/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('https://puntoyacr.com/');
});
