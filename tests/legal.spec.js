const { test, expect } = require('@playwright/test');

const legalPages = [
  ['centro-legal.html', /Centro Legal/i],
  ['terminos.html', /Términos de Servicio/i],
  ['privacidad.html', /Política de Privacidad/i],
  ['tratamiento-datos.html', /Tratamiento de Datos/i],
  ['propiedad-intelectual.html', /Contenido, copyright y marcas/i],
  ['uso-aceptable.html', /Uso Aceptable/i],
  ['condiciones-pro.html', /PUNTO YA CR PRO/i],
  ['eliminar-cuenta.html', /eliminación de cuenta/i],
  ['proveedores.html', /Proveedores tecnológicos/i],
  ['reclamos-pi.html', /Reclamos de copyright/i],
];

test('centro legal y documentos principales cargan', async ({ page }) => {
  for (const [path, heading] of legalPages) {
    const response = await page.goto('/' + path);
    expect(response?.status(), path).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/PUNTO YA CR/i);
  }
});

test('footer público enlaza al centro legal y eliminación', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('link', { name: 'Centro Legal' })).toHaveAttribute('href', 'centro-legal.html');
  await expect(page.getByRole('link', { name: 'Eliminar cuenta' })).toHaveAttribute('href', 'eliminar-cuenta.html');
  await expect(page.locator('.newsletter-legal')).toContainText(/Privacidad/i);
});


test('formularios legales operativos están disponibles', async ({ page }) => {
  await page.goto('/eliminar-cuenta.html');
  await expect(page.locator('#privacyRequestForm')).toBeVisible();
  await expect(page.getByRole('button', { name: /Enviar solicitud/i })).toBeVisible();
  await page.goto('/reclamos-pi.html');
  await expect(page.locator('#ipClaimForm')).toBeVisible();
  await expect(page.getByRole('button', { name: /Enviar reclamo/i })).toBeVisible();
});

test('documentos públicos no muestran mensajes de borrador o pre-lanzamiento', async ({ page }) => {
  for (const path of ['centro-legal.html','tratamiento-datos.html','eliminar-cuenta.html']) {
    await page.goto('/' + path);
    await expect(page.locator('body')).not.toContainText(/versión de trabajo|antes de publicar comercialmente|borrador beta|antes del lanzamiento/i);
  }
});


test('newsletter usa salida de comunicaciones y no expone texto fiscal innecesario', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('link', { name: /Privacidad y comunicaciones/i })).toHaveAttribute('href', /type=marketing_optout/);

  for (const path of ['centro-legal.html','privacidad.html','terminos.html']) {
    await page.goto('/' + path);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Ministerio de Hacienda|actividad de programación informática|Domicilio fiscal/i);
    expect(body).toMatch(/Identificación:/i);
    expect(body).toMatch(/Domicilio del operador:/i);
  }
});
