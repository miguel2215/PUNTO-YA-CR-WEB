const { test, expect } = require('@playwright/test');

const URL = process.env.SUPABASE_URL || 'https://uspycwpztzkenwsevvrp.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy';
const A_EMAIL = process.env.TEST_A_EMAIL;
const A_PASSWORD = process.env.TEST_A_PASSWORD;
const B_EMAIL = process.env.TEST_B_EMAIL;
const B_PASSWORD = process.env.TEST_B_PASSWORD;
const ROLE_EMAIL = process.env.TEST_ROLE_EMAIL;
const ROLE_PASSWORD = process.env.TEST_ROLE_PASSWORD;

async function login(request, email, password) {
  const r = await request.post(`${URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: KEY, 'Content-Type':'application/json' }, data: { email, password }
  });
  expect(r.ok(), `No se pudo autenticar ${email}: ${r.status()} ${await r.text()}`).toBeTruthy();
  return (await r.json()).access_token;
}
async function rest(request, token, table, query='') {
  return request.get(`${URL}/rest/v1/${table}?${query}`, {
    headers: { apikey:KEY, Authorization:`Bearer ${token}`, Accept:'application/json' }
  });
}
async function membership(request, token) {
  const r = await rest(request, token, 'business_members', 'select=business_id,user_id,role,active&active=eq.true');
  expect(r.ok(), `business_members respondió ${r.status()}: ${await r.text()}`).toBeTruthy();
  const rows = await r.json();
  expect(rows.length, 'La cuenta de prueba no tiene membresía activa').toBeGreaterThan(0);
  return rows[0];
}

// Estas pruebas NO crean ni borran datos. Solo leen con usuarios de prueba separados.
test.describe('RLS / aislamiento entre negocios', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop-chromium', 'Seguridad se ejecuta una sola vez'));

  test('Negocio A no puede leer filas de Negocio B', async ({ request }) => {
    test.skip(!A_EMAIL || !A_PASSWORD || !B_EMAIL || !B_PASSWORD, 'Configura TEST_A_* y TEST_B_* en GitHub Secrets');
    const a = await login(request, A_EMAIL, A_PASSWORD);
    const b = await login(request, B_EMAIL, B_PASSWORD);
    const ma = await membership(request, a);
    const mb = await membership(request, b);
    expect(ma.business_id).not.toBe(mb.business_id);

    const tables = ['sales','sale_items','products','clients','payments','orders','business_expenses','business_suppliers','supplier_invoices','supplier_payments','business_growth_goals','business_accountants'];
    for (const table of tables) {
      const r = await rest(request, a, table, `select=business_id&business_id=eq.${mb.business_id}&limit=5`);
      if (r.status() === 404) continue; // tabla opcional aún no desplegada
      expect(r.ok(), `${table}: ${r.status()} ${await r.text()}`).toBeTruthy();
      expect(await r.json(), `RLS filtró mal ${table}: A pudo ver datos de B`).toEqual([]);
    }
  });

  test('Negocio B no puede leer filas de Negocio A', async ({ request }) => {
    test.skip(!A_EMAIL || !A_PASSWORD || !B_EMAIL || !B_PASSWORD, 'Configura TEST_A_* y TEST_B_* en GitHub Secrets');
    const a = await login(request, A_EMAIL, A_PASSWORD);
    const b = await login(request, B_EMAIL, B_PASSWORD);
    const ma = await membership(request, a);
    const mb = await membership(request, b);
    const r = await rest(request, b, 'sales', `select=business_id&business_id=eq.${ma.business_id}&limit=5`);
    expect(r.ok()).toBeTruthy();
    expect(await r.json(), 'RLS permitió a B leer ventas de A').toEqual([]);
    expect(ma.business_id).not.toBe(mb.business_id);
  });

  test('un miembro no-owner no puede escribir en tablas PRO reservadas al dueño', async ({ request }) => {
    test.skip(!ROLE_EMAIL || !ROLE_PASSWORD, 'Configura TEST_ROLE_* con una cuenta Caja o Cocina');
    const token = await login(request, ROLE_EMAIL, ROLE_PASSWORD);
    const m = await membership(request, token);
    test.skip(m.role === 'owner', 'TEST_ROLE_EMAIL debe ser Caja/Cocina u otro rol no-owner');

    // target_amount=0 viola el CHECK de la tabla. Si RLS estuviera roto, Postgres llegaría
    // a la validación y respondería 400, pero nunca se insertaría una fila real.
    const r = await request.post(`${URL}/rest/v1/business_growth_goals`, {
      headers: { apikey:KEY, Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Prefer:'return=representation' },
      data: { business_id:m.business_id, goal_type:'sales_monthly', target_amount:0, period_start:'2099-01-01', active:true }
    });
    expect([401,403], `Un rol ${m.role} alcanzó una escritura PRO que debe estar bloqueada por RLS (${r.status()})`).toContain(r.status());
  });

  test('un negocio FREE no puede escribir directamente en tablas PRO', async ({ request }) => {
    test.skip(!A_EMAIL || !A_PASSWORD, 'Configura TEST_A_* con una cuenta de prueba FREE');
    const token = await login(request, A_EMAIL, A_PASSWORD);
    const m = await membership(request, token);
    const plans = await rest(request, token, 'business_plans', `select=plan_tier,expires_at&business_id=eq.${m.business_id}&limit=1`);
    expect(plans.ok(), `business_plans respondió ${plans.status()}: ${await plans.text()}`).toBeTruthy();
    const rows = await plans.json();
    const plan = rows[0] || null;
    const activePro = plan && String(plan.plan_tier||'').toLowerCase()==='pro' && (!plan.expires_at || new Date(plan.expires_at).getTime() > Date.now());
    test.skip(activePro, 'TEST_A_EMAIL es PRO; usa una cuenta FREE para esta prueba');

    // Igual que arriba, el valor 0 evita crear basura aunque la política estuviera mal.
    const r = await request.post(`${URL}/rest/v1/business_growth_goals`, {
      headers: { apikey:KEY, Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Prefer:'return=representation' },
      data: { business_id:m.business_id, goal_type:'sales_monthly', target_amount:0, period_start:'2099-01-01', active:true }
    });
    expect([401,403], `Un negocio FREE alcanzó la escritura de una función PRO (${r.status()})`).toContain(r.status());
  });
});
