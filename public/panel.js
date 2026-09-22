/* =========================================================
   PUNTO YA CR
   PANEL DEL EMPRENDEDOR
   Conexión con Supabase
   ========================================================= */

const PANEL_SUPABASE_URL =
  "https://uspycwpztzkenwsevvrp.supabase.co";

const PANEL_SUPABASE_KEY =
  "sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy";

const PUNTO_YA_APP =
  "https://mipuntocr.mieduar2215.workers.dev/";


/* =========================================================
   CLIENTE SUPABASE
   ========================================================= */

let panelCloud = null;
let panelSession = null;
let panelUser = null;
let panelBusiness = null;
let panelMembership = null;
let __panelLoginInProgress = false;
let __panelInactivityTimer = null;
let __panelInactivityBound = false;
const PANEL_INACTIVITY_MS = 30 * 60 * 1000;

function getPanelEntryIntent(){
  const p=new URLSearchParams(window.location.search);
  return {access:p.get("access")||"",open:p.get("open")||"",reason:p.get("reason")||"",source:p.get("source")||""};
}

function startPanelInactivityWatch(){
  const reset=()=>{
    if(!panelUser)return;
    clearTimeout(__panelInactivityTimer);
    __panelInactivityTimer=setTimeout(async()=>{
      try{await panelCloud?.auth.signOut();}catch(_){}
      window.location.href="panel.html?reason=inactive";
    },PANEL_INACTIVITY_MS);
  };
  if(!__panelInactivityBound){
    ["pointerdown","keydown","touchstart","scroll"].forEach(ev=>window.addEventListener(ev,reset,{passive:true}));
    __panelInactivityBound=true;
  }
  reset();
}

async function handlePanelEntryIntent(authenticated){
  const intent=getPanelEntryIntent();
  if(!authenticated){
    if(intent.reason==="inactive") setTimeout(()=>{ if(!document.querySelector("#panelLoginModal")) openPanelLogin("Tu sesión se cerró por inactividad. Inicia sesión de nuevo."); },60);
    else if(intent.access==="login") setTimeout(()=>openPanelLogin(),60);
    else if(intent.access==="create") window.location.replace(PUNTO_YA_APP + "?access=create" + (intent.source ? `&source=${encodeURIComponent(intent.source)}` : ""));
    return;
  }
  if(intent.open==="plan") { await renderPlanSection(); }
}


/* =========================================================
   INICIAR SUPABASE
   ========================================================= */

function initPanelCloud() {

  if (panelCloud) return true;

  if (!window.supabase?.createClient) {
    console.error("Supabase no está disponible.");
    return false;
  }

  panelCloud = window.supabase.createClient(
    PANEL_SUPABASE_URL,
    PANEL_SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      }
    }
  );

  return true;
}


/* =========================================================
   BUSCAR NEGOCIO DEL USUARIO
   ========================================================= */

async function loadPanelBusiness(user) {

  if (!panelCloud || !user) return null;

  try {

    /*
      Primero buscamos la membresía del usuario.
      Esto mantiene la misma relación usuario → negocio
      que utiliza PUNTO YA CR.
    */

    const {
      data: membership,
      error: membershipError
    } = await panelCloud
      .from("business_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();


    if (membershipError) {
      throw membershipError;
    }


    if (!membership?.business_id) {

      panelMembership = null;
      panelBusiness = null;

      return null;
    }


    panelMembership = membership;


    /*
      Ahora obtenemos el negocio correspondiente.
      Las políticas RLS de Supabase deben determinar
      qué información puede consultar este usuario.
    */

    const {
      data: business,
      error: businessError
    } = await panelCloud
      .from("businesses")
      .select("*")
      .eq("id", membership.business_id)
      .maybeSingle();


    if (businessError) {
      throw businessError;
    }


    panelBusiness = business || null;

    return panelBusiness;

  } catch (error) {

    console.error(
      "No se pudo cargar el negocio:",
      error
    );

    panelBusiness = null;

    return null;
  }
}


/* =========================================================
   COMPROBAR SESIÓN
   ========================================================= */

async function checkPanelSession() {

  if (!initPanelCloud()) return false;

  try {

    const {
      data,
      error
    } = await panelCloud.auth.getSession();


    if (error) {
      throw error;
    }


    panelSession = data?.session || null;
    panelUser = panelSession?.user || null;


    /*
      SIN SESIÓN

      Por ahora dejamos visible la pantalla actual:
      Iniciar sesión / Crear mi negocio.
    */

    if (!panelUser) {

      console.log(
        "Panel del Emprendedor: sin sesión."
      );

      document.body.classList.remove(
        "panel-authenticated"
      );

      document.body.classList.add(
        "panel-guest"
      );

      return false;
    }


    /*
      CON SESIÓN
    */

    await loadPanelBusiness(panelUser);


    document.body.classList.remove(
      "panel-guest"
    );

    document.body.classList.add(
      "panel-authenticated"
    );

    if (panelBusiness) {
      await renderPanelDashboard();
      startPanelInactivityWatch();
    } else {
      document.body.innerHTML = `<main class="panel-main"><section class="access-card"><div class="access-heading"><span class="access-tag">PUNTO YA CR</span><h2>No encontramos un negocio asociado</h2><p>Puedes crear uno desde PUNTO YA CR o iniciar sesión con otra cuenta.</p></div><div class="access-option"><a class="panel-button green-button" href="${PUNTO_YA_APP}?access=create">Crear mi negocio</a><button class="panel-button primary-button" type="button" onclick="panelLogout()">Usar otra cuenta</button></div></section></main>`;
    }


    console.log(
      "Panel del Emprendedor: sesión encontrada.",
      {
        user: panelUser.id,
        business: panelBusiness?.id || null
      }
    );


    /*
      Más adelante aquí llamaremos:

      renderDashboard();

      y mostraremos:
      - Nombre del propietario
      - Negocio
      - Restaurante / Retail
      - Plan Free / Pro
      - Cuenta
      - Dispositivos
      - Configuración
      - Soporte
    */

    return true;

  } catch (error) {

    console.error(
      "Error iniciando Panel del Emprendedor:",
      error
    );

    return false;
  }
}


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

async function panelLogout() {

  if (!panelCloud) return;

  try {

    await panelCloud.auth.signOut();

    panelSession = null;
    panelUser = null;
    panelBusiness = null;
    panelMembership = null;
    clearTimeout(__panelInactivityTimer);
    clearEntrepreneurSnapshotCache();

    window.location.href = "panel.html";

  } catch (error) {

    console.error(
      "No se pudo cerrar la sesión:",
      error
    );
  }
}


window.panelLogout = panelLogout;


/* =========================================================
   CAMBIOS DE AUTENTICACIÓN
   ========================================================= */

function listenPanelAuth() {

  if (!panelCloud) return;

  panelCloud.auth.onAuthStateChange(
    async (event, session) => {

      panelSession = session || null;
      panelUser = session?.user || null;


      if (event === "SIGNED_OUT") {

        panelBusiness = null;
        panelMembership = null;
        clearTimeout(__panelInactivityTimer);

        document.body.classList.remove(
          "panel-authenticated"
        );

        document.body.classList.add(
          "panel-guest"
        );

        return;
      }


      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

      if (panelUser && event === "SIGNED_IN" && __panelLoginInProgress) return;

      if (panelUser && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        await loadPanelBusiness(panelUser);
        if (panelBusiness) {
          await renderPanelDashboard();
          startPanelInactivityWatch();
        }
      }

    }
  );
}


/* =========================================================
   ARRANQUE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    if (!initPanelCloud()) return;

    listenPanelAuth();

    const authenticated = await checkPanelSession();
    await handlePanelEntryIntent(authenticated);

  }
);
/* =========================================================
   LOGIN DEL PANEL DEL EMPRENDEDOR
   ========================================================= */

function openPanelLogin(initialMessage = "") {

  const existing = document.querySelector("#panelLoginModal");

  if (existing) {
    existing.remove();
  }

  const modal = document.createElement("div");

  modal.id = "panelLoginModal";
  modal.className = "panel-login-overlay";

  modal.innerHTML = `
    <div class="panel-login-modal">

      <button
        type="button"
        class="panel-login-close"
        onclick="closePanelLogin()"
        aria-label="Cerrar">
        ×
      </button>

      <span class="access-tag">
        PUNTO YA CR
      </span>

      <h2>Iniciar sesión</h2>

      <p>
        Usa la misma cuenta de PUNTO YA CR.
      </p>

      <div class="panel-login-field">
        <label for="panelLoginEmail">
          Correo
        </label>

        <input
          id="panelLoginEmail"
          type="email"
          autocomplete="email"
          placeholder="correo@ejemplo.com">
      </div>

      <div class="panel-login-field">
        <label for="panelLoginPassword">
          Contraseña
        </label>

        <input
          id="panelLoginPassword"
          type="password"
          autocomplete="current-password"
          placeholder="Tu contraseña">
      </div>

      <div
        id="panelLoginError"
        class="panel-login-error"
        hidden>
      </div>

      <button
        id="panelLoginSubmit"
        type="button"
        class="panel-button primary-button panel-login-submit"
        onclick="panelLogin()">
        Iniciar sesión
      </button>

      <button
        type="button"
        class="panel-login-forgot"
        onclick="panelForgotPassword()">
        ¿Olvidaste tu contraseña?
      </button>

    </div>
  `;

  document.body.appendChild(modal);

  if (initialMessage) showPanelLoginError(initialMessage);

  setTimeout(() => {

    document
      .querySelector("#panelLoginEmail")
      ?.focus();

  }, 50);
}


function closePanelLogin() {

  document
    .querySelector("#panelLoginModal")
    ?.remove();
}


/* =========================================================
   INICIAR SESIÓN CON SUPABASE
   ========================================================= */

async function panelLogin() {

  if (!initPanelCloud()) {
    return;
  }


  const email =
    document
      .querySelector("#panelLoginEmail")
      ?.value
      .trim()
      .toLowerCase();


  const password =
    document
      .querySelector("#panelLoginPassword")
      ?.value || "";


  const errorBox =
    document.querySelector("#panelLoginError");


  const button =
    document.querySelector("#panelLoginSubmit");


  if (!email || !password) {

    showPanelLoginError(
      "Escribe tu correo y contraseña."
    );

    return;
  }


  try {

    __panelLoginInProgress = true;

    if (button) {

      button.disabled = true;
      button.textContent = "Ingresando...";

    }


    const {
      data,
      error
    } = await panelCloud.auth.signInWithPassword({
      email,
      password
    });


    if (error) {
      throw error;
    }


    if (!data?.session?.user) {

      throw new Error(
        "No se pudo iniciar la sesión."
      );

    }


    panelSession = data.session;
    panelUser = data.session.user;


    await loadPanelBusiness(panelUser);


    if (!panelBusiness) {

      await panelCloud.auth.signOut();

      throw new Error(
        "No encontramos un negocio asociado a esta cuenta."
      );

    }


    closePanelLogin();


    document.body.classList.remove(
      "panel-guest"
    );

    document.body.classList.add(
      "panel-authenticated"
    );


    /*
      En el siguiente paso sustituiremos esto
      por renderPanelDashboard().
    */

    console.log(
  "Acceso correcto al Panel:",
  {
    user: panelUser.id,
    business: panelBusiness.id
  }
);

await renderPanelDashboard();
    startPanelInactivityWatch();
    await handlePanelEntryIntent(true);


  } catch (error) {

    console.error(
      "Login del Panel:",
      error
    );


    const message =
      String(error?.message || "")
        .toLowerCase();


    if (
      message.includes(
        "invalid login credentials"
      )
    ) {

      showPanelLoginError(
        "Correo o contraseña incorrectos."
      );

    } else if (
      message.includes(
        "email not confirmed"
      )
    ) {

      showPanelLoginError(
        "Primero confirma tu correo electrónico."
      );

    } else {

      showPanelLoginError(
        error?.message ||
        "No se pudo iniciar sesión."
      );

    }

  } finally {

    __panelLoginInProgress = false;

    if (button) {

      button.disabled = false;
      button.textContent = "Iniciar sesión";

    }

  }
}


function showPanelLoginError(message) {

  const box =
    document.querySelector("#panelLoginError");


  if (!box) return;


  box.textContent = message;
  box.hidden = false;
}


/* =========================================================
   RECUPERAR CONTRASEÑA
   ========================================================= */

async function panelForgotPassword() {

  const email =
    document
      .querySelector("#panelLoginEmail")
      ?.value
      .trim()
      .toLowerCase();


  if (!email) {

    showPanelLoginError(
      "Escribe primero tu correo."
    );

    return;
  }


  try {

    const {
      error
    } = await panelCloud.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          window.location.origin +
          window.location.pathname
      }
    );


    if (error) {
      throw error;
    }


    showPanelLoginError(
      "Te enviamos un correo para recuperar tu contraseña."
    );


  } catch (error) {

    showPanelLoginError(
      error?.message ||
      "No se pudo enviar el correo."
    );

  }
}


window.openPanelLogin = openPanelLogin;
window.closePanelLogin = closePanelLogin;
window.panelLogin = panelLogin;
window.panelForgotPassword = panelForgotPassword;
/* =========================================================
   DASHBOARD DEL EMPRENDEDOR
   ========================================================= */

let __panelSnapshotCache = { summary:null, full:null };
let __panelSnapshotPromise = { summary:null, full:null };
let __panelSnapshotBusinessId = null;

function panelPlanIsActive(plan) {
  if (!plan || String(plan.plan_tier || "free").toLowerCase() !== "pro") return false;
  if (!plan.expires_at) return true;
  const expires = new Date(plan.expires_at);
  return !Number.isNaN(expires.getTime()) && expires.getTime() > Date.now();
}

function clearEntrepreneurSnapshotCache() {
  __panelSnapshotCache = { summary:null, full:null };
  __panelSnapshotPromise = { summary:null, full:null };
  __panelSnapshotBusinessId = panelBusiness?.id || null;
}

async function loadEntrepreneurSnapshot(mode = "summary", force = false) {
  const empty = { planTier:"free", sales:[], saleItems:[], products:[], clients:[], payments:[], creditMoves:[], orders:[], expenses:[], suppliers:[], supplierInvoices:[], supplierPayments:[], growthGoals:[], accountant:null };
  if (!panelCloud || !panelBusiness?.id) return empty;
  const businessId = panelBusiness.id;
  const key = mode === "full" ? "full" : "summary";

  if (__panelSnapshotBusinessId !== businessId) clearEntrepreneurSnapshotCache();
  __panelSnapshotBusinessId = businessId;

  if (!force && __panelSnapshotCache[key]) return __panelSnapshotCache[key];
  if (!force && __panelSnapshotPromise[key]) return __panelSnapshotPromise[key];

  const safe = async promise => { try { const r = await promise; return r?.error ? [] : (r?.data || []); } catch (_) { return []; } };

  __panelSnapshotPromise[key] = (async () => {
    let base = !force && __panelSnapshotCache.summary ? __panelSnapshotCache.summary : null;

    if (!base) {
      const planRows = await safe(panelCloud.from("business_plans").select("plan_tier,plan_source,plan_period,starts_at,expires_at").eq("business_id", businessId).limit(1));
      const planTier = panelPlanIsActive(planRows[0]) ? "pro" : "free";
      const since = new Date(); since.setDate(since.getDate() - 70); const sinceISO = since.toISOString();
      const monthDate = new Date(); monthDate.setDate(monthDate.getDate() - 35); const monthDateISO = monthDate.toISOString().slice(0,10);

      const requests = [
        safe(panelCloud.from("sales").select("id,total,status,payment_method,created_at,client_id").eq("business_id", businessId).gte("created_at",sinceISO).order("created_at", {ascending:false}).limit(1200)),
        safe(panelCloud.from("sale_items").select("sale_id,product_id,product_name,quantity,unit_price,subtotal,created_at").eq("business_id", businessId).gte("created_at",sinceISO).order("created_at", {ascending:false}).limit(2500)),
        safe(panelCloud.from("products").select("id,name,price,cost,stock,active,business_type").eq("business_id", businessId).eq("active", true).limit(1200)),
        safe(panelCloud.from("clients").select("id,name,active,created_at").eq("business_id", businessId).eq("active", true).limit(1200)),
        safe(panelCloud.from("payments").select("sale_id,method,amount,created_at").eq("business_id", businessId).gte("created_at",sinceISO).order("created_at", {ascending:false}).limit(1500)),
        safe(panelCloud.from("credit_movements").select("movement_type,amount,created_at,client_id").eq("business_id", businessId).gte("created_at",sinceISO).order("created_at", {ascending:false}).limit(1500)),
        safe(panelCloud.from("orders").select("id,status,created_at").eq("business_id", businessId).gte("created_at",sinceISO).order("created_at", {ascending:false}).limit(500))
      ];

      if (planTier === "pro") {
        requests.push(
          safe(panelCloud.from("business_expenses").select("total,expense_date,voided,created_at").eq("business_id",businessId).gte("expense_date",monthDateISO).order("expense_date",{ascending:false}).limit(600)),
          safe(panelCloud.from("supplier_invoices").select("id,total,balance_due,condition,due_date,voided,invoice_date").eq("business_id",businessId).eq("voided",false).order("invoice_date",{ascending:false}).limit(800)),
          safe(panelCloud.from("supplier_payments").select("invoice_id,amount,payment_date,created_at").eq("business_id",businessId).order("payment_date",{ascending:false}).limit(1500))
        );
      }

      const rows = await Promise.all(requests);
      const [sales,saleItems,products,clients,payments,creditMoves,orders] = rows;
      const expenses = planTier === "pro" ? rows[7] : [];
      const supplierInvoices = planTier === "pro" ? rows[8] : [];
      const supplierPayments = planTier === "pro" ? rows[9] : [];
      base = { planTier, sales, saleItems, products, clients, payments, creditMoves, orders, expenses, suppliers:[], supplierInvoices, supplierPayments, growthGoals:[], accountant:null };
      __panelSnapshotCache.summary = base;
    }

    if (key === "summary") return base;

    const [expenses, suppliers, supplierInvoices, supplierPayments, growthGoals, accountantRows] = await Promise.all([
      safe(panelCloud.from("business_expenses").select("*").eq("business_id", businessId).order("expense_date", {ascending:false}).limit(1500)),
      safe(panelCloud.from("business_suppliers").select("*").eq("business_id", businessId).order("name", {ascending:true}).limit(600)),
      safe(panelCloud.from("supplier_invoices").select("*").eq("business_id", businessId).order("invoice_date", {ascending:false}).limit(1500)),
      safe(panelCloud.from("supplier_payments").select("*").eq("business_id", businessId).order("payment_date", {ascending:false}).limit(2000)),
      safe(panelCloud.from("business_growth_goals").select("*").eq("business_id", businessId).order("created_at", {ascending:false}).limit(100)),
      safe(panelCloud.from("business_accountants").select("*").eq("business_id", businessId).limit(1))
    ]);
    const result = { ...base, expenses, suppliers, supplierInvoices, supplierPayments, growthGoals, accountant:accountantRows[0]||null };
    __panelSnapshotCache.full = result;
    return result;
  })();

  try { return await __panelSnapshotPromise[key]; }
  finally { __panelSnapshotPromise[key] = null; }
}

function panelMoney(value) {
  return new Intl.NumberFormat("es-CR", { style:"currency", currency:"CRC", maximumFractionDigits:0 }).format(Number(value || 0));
}
function panelDayStart(d=new Date()) { const x=new Date(d); x.setHours(0,0,0,0); return x; }
function panelSum(rows, field="total") { return rows.reduce((a,r)=>a+Number(r?.[field]||0),0); }
function panelPct(current, previous) { if (!previous) return current ? 100 : 0; return ((current-previous)/previous)*100; }
function panelTrendText(pct) { if (Math.abs(pct)<0.5) return "similar al período anterior"; return `${Math.abs(pct).toFixed(0)}% ${pct>0?"más":"menos"} que el período anterior`; }
function panelActiveSales(rows) { return rows.filter(s => String(s.status||"active").toLowerCase() !== "voided"); }

function buildEntrepreneurMetrics(data) {
  const now=new Date(), today=panelDayStart(now), tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const d7=new Date(today); d7.setDate(d7.getDate()-6);
  const prev7=new Date(d7); prev7.setDate(prev7.getDate()-7);
  const d30=new Date(today); d30.setDate(d30.getDate()-29);
  const prev30=new Date(d30); prev30.setDate(prev30.getDate()-30);
  const active=panelActiveSales(data.sales);
  const inRange=(r,a,b)=>{const d=new Date(r.created_at); return d>=a && d<b;};
  const todaySales=active.filter(r=>inRange(r,today,tomorrow));
  const week=active.filter(r=>inRange(r,d7,tomorrow));
  const prevWeek=active.filter(r=>inRange(r,prev7,d7));
  const month=active.filter(r=>inRange(r,d30,tomorrow));
  const prevMonth=active.filter(r=>inRange(r,prev30,d30));
  const todayRevenue=panelSum(todaySales), weekRevenue=panelSum(week), prevWeekRevenue=panelSum(prevWeek), monthRevenue=panelSum(month), prevMonthRevenue=panelSum(prevMonth);
  const weekPct=panelPct(weekRevenue,prevWeekRevenue), monthPct=panelPct(monthRevenue,prevMonthRevenue);
  const ticket=todaySales.length?todayRevenue/todaySales.length:0;
  const monthIds=new Set(month.map(s=>s.id));
  const monthItems=data.saleItems.filter(i=>monthIds.has(i.sale_id));
  const productMap={};
  for(const i of monthItems){const k=i.product_name||"Producto"; productMap[k]=(productMap[k]||0)+Number(i.quantity||0);}
  const topProducts=Object.entries(productMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const payMap={};
  const monthPayments=data.payments.filter(p=>inRange(p,d30,tomorrow));
  for(const p of monthPayments){const k=p.method||"Otro"; payMap[k]=(payMap[k]||0)+Number(p.amount||0);}
  if(!monthPayments.length) for(const s of month){const k=s.payment_method||"Otro"; payMap[k]=(payMap[k]||0)+Number(s.total||0);}
  const lowStock=data.products.filter(p=>Number(p.stock||0)<=5).sort((a,b)=>Number(a.stock||0)-Number(b.stock||0)).slice(0,6);
  let credit=0; for(const m of data.creditMoves){const t=String(m.movement_type||""); const a=Number(m.amount||0); if(t==="credit_sale") credit+=a; else if(t==="credit_payment"||t==="payment"||t==="void") credit-=a;}
  credit=Math.max(0,credit);
  const productCost=new Map(data.products.map(p=>[p.id,Number(p.cost||0)]));
  let estimatedCost=0; for(const i of monthItems) estimatedCost += (productCost.get(i.product_id)||0)*Number(i.quantity||0);
  const estimatedMargin=monthRevenue-estimatedCost;
  const days={}; for(const s of month){const label=new Intl.DateTimeFormat("es-CR",{weekday:"long"}).format(new Date(s.created_at)); days[label]=(days[label]||0)+Number(s.total||0);}
  const bestDay=Object.entries(days).sort((a,b)=>b[1]-a[1])[0]||null;
  const monthExpenses=(data.expenses||[]).filter(r=>{const d=new Date(r.expense_date||r.created_at);return d>=d30&&d<tomorrow&&!r.voided;});
  const expenseTotal=panelSum(monthExpenses,"total");
  const invoices=(data.supplierInvoices||[]).filter(r=>!r.voided);
  const invoiceBalances=invoices.map(r=>panelInvoiceBalance(r,data.supplierPayments||[]));
  const payable=invoiceBalances.reduce((a,b)=>a+Number(b||0),0);
  const overdue=invoices.reduce((a,r)=>{const bal=panelInvoiceBalance(r,data.supplierPayments||[]); const due=r.due_date?new Date(`${r.due_date}T12:00:00`):null; return a+(due&&due<today&&bal>0?bal:0)},0);
  const netBeforeOther=estimatedMargin-expenseTotal;
  return {todayRevenue,todayCount:todaySales.length,ticket,weekRevenue,weekPct,monthRevenue,monthPct,monthCount:month.length,topProducts,payMap,lowStock,credit,estimatedCost,estimatedMargin,expenseTotal,netBeforeOther,payable,overdue,bestDay,clientCount:data.clients.length,productCount:data.products.length,orderCount:data.orders.filter(o=>!["delivered","entregado","cancelled","canceled"].includes(String(o.status||"").toLowerCase())).length};
}

let __panelDashboardRendering = false;
async function renderPanelDashboard() {
  if (!panelUser || !panelBusiness || __panelDashboardRendering) return;
  __panelDashboardRendering = true;
  const businessName=panelBusiness.name||"Mi negocio";
  const ownerName=panelBusiness.owner_name||panelUser.user_metadata?.full_name||panelUser.user_metadata?.name||"";
  const businessType=panelBusiness.business_type||"";
  const typeLabel=businessType==="food"?"Restaurante":businessType==="products"?"Retail":"Negocio";
  document.body.innerHTML=`<div class="entrepreneur-dashboard"><header class="dashboard-header"><div class="dashboard-header-inner"><a href="index.html" class="dashboard-brand"><img src="assets/logo-horizontal.png" alt="PUNTO YA CR"></a><div class="dashboard-account"><div class="dashboard-business-mini"><strong>${escapePanelHTML(businessName)}</strong><span>Cargando tu negocio…</span></div><button type="button" class="dashboard-logout" onclick="panelLogout()">Cerrar sesión</button></div></div></header><main class="dashboard-main"><section class="dashboard-welcome"><span class="dashboard-eyebrow">PANEL DEL EMPRENDEDOR</span><h1>${ownerName?`Hola, ${escapePanelHTML(ownerName)}.`:"Hola."}</h1><p>Estamos preparando la vista de <strong>${escapePanelHTML(businessName)}</strong>.</p></section><div class="panel-loading-card">Leyendo la información real de tu negocio…</div></main></div>`;
  const data=await loadEntrepreneurSnapshot();
  const m=buildEntrepreneurMetrics(data); const isPro=data.planTier==="pro"; const planLabel=isPro?"PUNTO YA CR Pro":"PUNTO YA CR Free";
  const paymentHtml=Object.entries(m.payMap).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`<div class="money-line"><span>${escapePanelHTML(k)}</span><strong>${panelMoney(v)}</strong></div>`).join("")||`<p class="panel-empty">Aún no hay pagos sincronizados en este período.</p>`;
  const topHtml=m.topProducts.map(([n,q],i)=>`<div class="rank-line"><span class="rank-number">${i+1}</span><span>${escapePanelHTML(n)}</span><strong>${Number(q).toLocaleString("es-CR")}</strong></div>`).join("")||`<p class="panel-empty">Cuando registres ventas, aquí verás lo que más se vende.</p>`;
  const alerts=[]; if(m.lowStock.length) alerts.push(`${m.lowStock.length} producto${m.lowStock.length>1?"s":""} con existencias bajas.`); if(m.credit>0) alerts.push(`${panelMoney(m.credit)} pendientes en crédito.`); if(m.orderCount) alerts.push(`${m.orderCount} pedido${m.orderCount>1?"s":""} pendiente${m.orderCount>1?"s":""}.`); if(!alerts.length) alerts.push("No vemos alertas importantes con los datos sincronizados.");
  const insight1=m.weekRevenue?`Esta semana vendiste ${panelTrendText(m.weekPct)}.`:"Cuando tengas más ventas podremos comparar tus semanas.";
  const insight2=m.bestDay?`${m.bestDay[0][0].toUpperCase()+m.bestDay[0].slice(1)} ha sido tu día con más ventas en los últimos 30 días.`:"Todavía no hay suficiente historial para detectar tu mejor día.";
  document.body.innerHTML=`
  <div class="entrepreneur-dashboard ${isPro?"plan-pro":"plan-free"}">
   <header class="dashboard-header"><div class="dashboard-header-inner"><a href="index.html" class="dashboard-brand"><img src="assets/logo-horizontal.png" alt="PUNTO YA CR"></a><nav class="panel-topnav"><a href="#resumen">Resumen</a><a href="#ventas">Ventas</a><button onclick="openDashboardSection('money')">Dinero</button><button onclick="openDashboardSection('growth')">Crecimiento</button><button onclick="openDashboardSection('accounting')">Contabilidad</button></nav><div class="dashboard-account"><div class="dashboard-business-mini"><strong>${escapePanelHTML(businessName)}</strong><span>${planLabel}</span></div><button class="dashboard-logout" onclick="panelLogout()">Cerrar sesión</button></div></div></header>
   <main class="dashboard-main entrepreneur-main">
    <section id="resumen" class="business-overview-head"><div><span class="dashboard-eyebrow">ASÍ VA TU NEGOCIO</span><h1>${escapePanelHTML(businessName)}</h1><p>${escapePanelHTML(typeLabel)} · Datos sincronizados desde PUNTO YA CR.</p></div><span class="plan-pill ${isPro?"pro":"free"}">${isPro?"PRO":"FREE"}</span></section>
    <section class="metric-grid"><article class="metric-card hero"><span>Ventas de hoy</span><strong>${panelMoney(m.todayRevenue)}</strong><small>${m.todayCount} venta${m.todayCount===1?"":"s"}</small></article><article class="metric-card"><span>Ticket promedio</span><strong>${panelMoney(m.ticket)}</strong><small>Hoy</small></article><article class="metric-card"><span>Esta semana</span><strong>${panelMoney(m.weekRevenue)}</strong><small>${m.weekRevenue?panelTrendText(m.weekPct):"Sin comparación todavía"}</small></article><article class="metric-card"><span>Últimos 30 días</span><strong>${panelMoney(m.monthRevenue)}</strong><small>${m.monthCount} ventas</small></article></section>
    <section class="business-story"><div><span class="dashboard-eyebrow">EN PALABRAS SIMPLES</span><h2>${isPro?"Lo que está pasando en tu negocio":"Una mirada rápida a tu negocio"}</h2></div><div class="story-cards"><article><strong>${insight1}</strong><span>${isPro?insight2:"Con Pro también puedes descubrir tendencias, comparaciones y oportunidades."}</span></article><article><strong>${alerts[0]}</strong><span>${alerts.slice(1).join(" ")||"Revisa esta información cuando lo necesites."}</span></article></div></section>
    <section id="ventas" class="panel-business-grid"><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">VENTAS</span><h2>Lo que más vendes</h2></div><span>30 días</span></div>${topHtml}</article><article id="dinero" class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">DINERO</span><h2>Cómo te pagaron</h2></div><span>30 días</span></div>${paymentHtml}<div class="money-total"><span>Crédito pendiente</span><strong>${panelMoney(m.credit)}</strong></div></article></section>
    ${isPro?`<section class="pro-zone"><div class="pro-zone-title"><span class="dashboard-eyebrow">PUNTO YA CR PRO</span><h2>Controla el dinero y haz crecer tu negocio</h2><p>Datos reales, comparaciones y reglas claras. Sin IA.</p></div><div class="pro-metric-grid"><article><span>Ventas 30 días</span><strong>${panelMoney(m.monthRevenue)}</strong><small>${panelTrendText(m.monthPct)}</small></article><article><span>Gastos registrados</span><strong>${panelMoney(m.expenseTotal)}</strong><small>Últimos 30 días</small></article><article><span>Por pagar</span><strong>${panelMoney(m.payable)}</strong><small>${m.overdue?panelMoney(m.overdue)+" vencido":"Sin vencidos registrados"}</small></article><article><span>Margen antes de otros ajustes</span><strong>${panelMoney(m.netBeforeOther)}</strong><small>Ventas − costo registrado − gastos</small></article></div><div id="crecimiento" class="growth-grid"><button class="growth-card growth-action" onclick="openDashboardSection('growth')"><span class="growth-icon">↗</span><h3>Crecimiento</h3><p>Evolución, salud, metas, oportunidades, clientes, productos y simulador.</p><b>Abrir Crecimiento →</b></button><button class="growth-card growth-action" onclick="openDashboardSection('money')"><span class="growth-icon">₡</span><h3>Dinero</h3><p>Ingresos, gastos, compras, por cobrar, por pagar y flujo.</p><b>Abrir Dinero →</b></button><button class="growth-card growth-action" onclick="openDashboardSection('accounting')"><span class="growth-icon">▤</span><h3>Contabilidad</h3><p>Comprobantes, proveedores, pagos y paquete para tu contador.</p><b>Abrir Contabilidad →</b></button><article class="growth-card"><span class="growth-icon">◎</span><h3>Salud del negocio</h3><p>${alerts.join(" ")}</p></article></div></section>`:`<section id="crecimiento" class="free-pro-preview"><div><span class="dashboard-eyebrow">PUNTO YA CR PRO</span><h2>Controla el dinero y entiende tu crecimiento.</h2><p>Pro agrega Dinero, Crecimiento y Contabilidad para tu contador.</p></div><button onclick="openDashboardSection('plan')">Conocer Pro →</button><div class="preview-grid"><span>Dinero</span><span>Crecimiento</span><span>Metas</span><span>Por pagar / cobrar</span><span>Contabilidad</span><span>Mi contador</span></div></section>`}
    <section class="panel-alert-section"><div class="data-card-head"><div><span class="dashboard-eyebrow">ATENCIÓN</span><h2>Lo que conviene revisar</h2></div></div><div class="alert-list">${alerts.map(a=>`<div><span>!</span><p>${escapePanelHTML(a)}</p></div>`).join("")}</div></section>
    <section class="dashboard-tools admin-zone"><div class="dashboard-section-title"><div><span class="dashboard-eyebrow">ADMINISTRACIÓN</span><h2>Tu cuenta y tu negocio</h2></div></div><div class="dashboard-tool-grid">${[["business","🏪","Mi negocio","Información, contacto y ubicación."],["account","👤","Mi cuenta","Perfil y seguridad."],["devices","▣","Dispositivos","Accesos y sincronización."],["billing","₡","Facturación","Configuración fiscal."],["plan","✦",planLabel,"Estado de tu plan."],["support","?","Soporte","Ayuda de PUNTO YA CR."]].map(([id,ic,t,d])=>`<button class="dashboard-tool" onclick="openDashboardSection('${id}')"><span class="dashboard-tool-icon">${ic}</span><span><strong>${escapePanelHTML(t)}</strong><small>${escapePanelHTML(d)}</small></span><b>→</b></button>`).join("")}</div></section>
    <div id="platformAdminAccess"></div>
    <section class="pos-return"><div><span class="dashboard-eyebrow">PUNTO DE VENTA</span><h2>¿Listo para trabajar?</h2><p>Vuelve a ventas, caja, pedidos y operación diaria.</p></div><a href="${PUNTO_YA_APP}">Abrir PUNTO YA CR →</a></section>
   </main><footer class="dashboard-footer"><img src="assets/logo-horizontal.png" alt="PUNTO YA CR"><p>© 2026 PUNTO YA CR · Tu negocio, más simple.</p></footer>
  </div>`;
  window.__panelMetrics=m; window.__panelIsPro=isPro;
  checkPlatformAdminAccess();
  __panelDashboardRendering = false;
}

function askPuntoYa(topic) {
  const m=window.__panelMetrics; const box=document.querySelector('#puntoAnswer'); if(!m||!box) return;
  const answers={ventas:`En los últimos 30 días registraste ${panelMoney(m.monthRevenue)} en ${m.monthCount} ventas. Esta semana llevas ${panelMoney(m.weekRevenue)}.`,producto:m.topProducts.length?`Lo que más has vendido es ${m.topProducts[0][0]}, con ${Number(m.topProducts[0][1]).toLocaleString('es-CR')} unidades en los últimos 30 días.`:"Todavía no hay suficientes ventas sincronizadas para identificar tu producto principal.",alertas:m.lowStock.length?`Revisaría primero el inventario: tienes ${m.lowStock.length} productos con 5 unidades o menos.${m.credit>0?` También hay ${panelMoney(m.credit)} pendientes en crédito.`:""}`:(m.credit>0?`Lo principal a revisar son ${panelMoney(m.credit)} pendientes en crédito.`:"No veo alertas importantes con los datos sincronizados."),crecimiento:m.monthRevenue?`Tus ventas de los últimos 30 días están ${panelTrendText(m.monthPct)}.`:"Necesitamos más historial de ventas para medir crecimiento."};
  box.textContent=answers[topic]||"Puedo ayudarte a entender tus ventas, productos, alertas y crecimiento.";
}
window.askPuntoYa=askPuntoYa;

function openDashboardSection(section) {

  if (section === "business") {
    renderBusinessSection();
    return;
  }
   if (section === "account") {
  renderAccountSection();
  return;
}

  if (section === "money") { renderMoneySection(); return; }

  if (section === "growth") { renderGrowthSection(); return; }

  if (section === "accounting") { renderAccountingSection(); return; }

  if (section === "devices") {
    renderDevicesSection();
    return;
  }

  if (section === "billing") {
    renderBillingSection();
    return;
  }

  if (section === "plan") {
    renderPlanSection();
    return;
  }

  if (section === "support") {
    renderSupportSection();
    return;
  }

  renderPanelDashboard();
}
/* =========================================================
   MI NEGOCIO
   Tu negocio, más simple.
   ========================================================= */

function renderBusinessSection() {

  if (!panelBusiness) {
    renderPanelDashboard();
    return;
  }

  const businessName =
    panelBusiness.name ||
    panelBusiness.business_name ||
    "";

  const businessType =
    panelBusiness.business_type ||
    panelBusiness.type ||
    "food";

  const businessProfile =
  panelBusiness.settings?.business_profile || {};

const phone =
  businessProfile.phone || "";

const whatsapp =
  businessProfile.whatsapp || "";

const email =
  businessProfile.email || "";

const province =
  businessProfile.province || "";

const canton =
  businessProfile.canton || "";

const address =
  businessProfile.address || "";

const businessLogoUrl =
  businessProfile.logo_url || "";


  document.body.innerHTML = `

    <div class="entrepreneur-dashboard">

      <!-- HEADER -->

      <header class="dashboard-header">

        <div class="dashboard-header-inner">

          <button
            type="button"
            class="dashboard-brand dashboard-brand-button"
            onclick="renderPanelDashboard()">

            <img
              src="assets/logo-horizontal.png"
              alt="PUNTO YA CR">

          </button>


          <div class="dashboard-account">

            <div class="dashboard-business-mini">

              <strong>
                ${escapePanelHTML(businessName || "Mi negocio")}
              </strong>

              <span>
                Panel del Emprendedor
              </span>

            </div>


            <button
              type="button"
              class="dashboard-logout"
              onclick="panelLogout()">

              Cerrar sesión

            </button>

          </div>

        </div>

      </header>



      <!-- CONTENIDO -->

      <main class="dashboard-main business-settings-main">


        <!-- VOLVER -->

        <button
          type="button"
          class="business-back"
          onclick="renderPanelDashboard()">

          ← Volver al panel

        </button>



        <!-- ENCABEZADO -->

        <section class="business-settings-heading">

          <span class="dashboard-eyebrow">
            MI NEGOCIO
          </span>

          <h1>
            ${escapePanelHTML(businessName || "Mi negocio")}
          </h1>

          <p>
            La información esencial de tu negocio,
            en un solo lugar.
          </p>

        </section>



        <!-- FORMULARIO -->

        <section class="business-settings-card">


          <!-- INFORMACIÓN -->

          <div class="business-settings-block">

            <div class="business-settings-title">

              <div class="business-settings-icon">
                🏪
              </div>

              <div>

                <h2>
                  Información del negocio
                </h2>

                <p>
                  Lo básico para identificar tu negocio.
                </p>

              </div>

            </div>


            <div class="business-form-grid">

              <div class="business-field business-field-wide">

                <label for="businessName">
                  Nombre del negocio
                </label>

                <input
                  id="businessName"
                  type="text"
                  maxlength="80"
                  value="${escapePanelHTML(businessName)}"
                  placeholder="Nombre de tu negocio">

              </div>


              <div class="business-field">

                <label for="businessType">
                  Tipo de negocio
                </label>

                <select id="businessType">

                  <option
                    value="food"
                    ${businessType === "food" ? "selected" : ""}>
                    Restaurante
                  </option>

                  <option
                    value="products"
                    ${businessType === "products" ? "selected" : ""}>
                    Retail
                  </option>

                </select>

              </div>

            </div>

          </div>



          <!-- CONTACTO -->

          <div class="business-settings-block">

            <div class="business-settings-title">

              <div class="business-settings-icon">
                ☎
              </div>

              <div>

                <h2>
                  Contacto
                </h2>

                <p>
                  Cómo pueden comunicarse con tu negocio.
                </p>

              </div>

            </div>


            <div class="business-form-grid">

              <div class="business-field">

                <label for="businessPhone">
                  Teléfono
                </label>

                <input
                  id="businessPhone"
                  type="tel"
                  value="${escapePanelHTML(phone)}"
                  placeholder="Ej. 8888 8888">

              </div>


              <div class="business-field">

                <label for="businessWhatsapp">
                  WhatsApp
                </label>

                <input
                  id="businessWhatsapp"
                  type="tel"
                  value="${escapePanelHTML(whatsapp)}"
                  placeholder="Ej. 8888 8888">

              </div>


              <div class="business-field business-field-wide">

                <label for="businessEmail">
                  Correo del negocio
                </label>

                <input
                  id="businessEmail"
                  type="email"
                  value="${escapePanelHTML(email)}"
                  placeholder="negocio@correo.com">

              </div>

            </div>

          </div>



          <!-- UBICACIÓN -->

          <div class="business-settings-block">

            <div class="business-settings-title">

              <div class="business-settings-icon">
                ⌖
              </div>

              <div>

                <h2>
                  Ubicación
                </h2>

                <p>
                  Solo la información necesaria.
                </p>

              </div>

            </div>


            <div class="business-form-grid">

              <div class="business-field">

                <label for="businessProvince">
                  Provincia
                </label>

                <select id="businessProvince">

                  <option value="">
                    Seleccionar
                  </option>

                  ${[
                    "San José",
                    "Alajuela",
                    "Cartago",
                    "Heredia",
                    "Guanacaste",
                    "Puntarenas",
                    "Limón"
                  ].map(item => `
                    <option
                      value="${item}"
                      ${province === item ? "selected" : ""}>
                      ${item}
                    </option>
                  `).join("")}

                </select>

              </div>


              <div class="business-field">

                <label for="businessCanton">
                  Cantón
                </label>

                <input
                  id="businessCanton"
                  type="text"
                  value="${escapePanelHTML(canton)}"
                  placeholder="Ej. Santa Cruz">

              </div>


              <div class="business-field business-field-wide">

                <label for="businessAddress">
                  Dirección
                </label>

                <textarea
                  id="businessAddress"
                  rows="3"
                  placeholder="Una referencia sencilla para ubicar tu negocio">${escapePanelHTML(address)}</textarea>

              </div>

            </div>

          </div>



          <!-- IDENTIDAD VISUAL -->

          <div class="business-settings-block business-logo-block">
            <div class="business-settings-title">
              <div class="business-settings-icon">▣</div>
              <div>
                <h2>Identidad del negocio</h2>
                <p>Sube tu logo una sola vez. PUNTO YA CR podrá usarlo en reportes y documentos compatibles.</p>
              </div>
            </div>

            <div class="business-logo-manager">
              <div class="business-logo-preview" id="businessLogoPreview">
                ${businessLogoUrl
                  ? `<img src="${escapePanelHTML(businessLogoUrl)}" alt="Logo de ${escapePanelHTML(businessName)}">`
                  : `<div class="business-logo-placeholder"><strong>${escapePanelHTML((businessName || "N").slice(0,1).toUpperCase())}</strong><span>Sin logo</span></div>`}
              </div>
              <div class="business-logo-controls">
                <strong>Logo del negocio</strong>
                <p>PNG, JPG o WebP. Máximo 2 MB. Recomendado: formato cuadrado o horizontal con fondo limpio.</p>
                <input id="businessLogoFile" class="business-logo-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="previewBusinessLogo(this)">
                <div class="business-logo-actions">
                  <label for="businessLogoFile" class="account-secondary-button business-logo-upload">${businessLogoUrl ? "Cambiar logo" : "Subir logo"}</label>
                  ${businessLogoUrl ? `<button type="button" class="account-secondary-button danger-soft" onclick="removeBusinessLogo()">Eliminar logo</button>` : ""}
                </div>
                <small id="businessLogoStatus">El logo se guarda para este negocio.</small>
                <label class="legal-check business-logo-rights" id="businessLogoRightsWrap" hidden>
                  <input id="businessLogoRights" type="checkbox">
                  <span>Confirmo que soy titular del logo o cuento con autorización suficiente para utilizarlo y acepto las reglas de <a href="propiedad-intelectual.html" target="_blank" rel="noopener">contenido y propiedad intelectual</a>.</span>
                </label>
              </div>
            </div>
          </div>


          <!-- MENSAJE -->

          <div
            id="businessSaveMessage"
            class="business-save-message"
            hidden>
          </div>



          <!-- GUARDAR -->

          <div class="business-settings-actions">

            <button
              id="saveBusinessButton"
              type="button"
              class="business-save-button"
              onclick="saveBusinessSettings()">

              Guardar cambios

            </button>

          </div>


        </section>


        <p class="business-simple-note">
          PUNTO YA CR · Tu negocio, más simple.
        </p>


      </main>

    </div>

  `;
}


/* =========================================================
   GUARDAR MI NEGOCIO
   ========================================================= */

function previewBusinessLogo(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const status = document.querySelector("#businessLogoStatus");
  if (!["image/png","image/jpeg","image/webp"].includes(file.type)) {
    if (status) status.textContent = "Usa un archivo PNG, JPG o WebP.";
    input.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    if (status) status.textContent = "El logo no puede superar 2 MB.";
    input.value = "";
    return;
  }
  const preview = document.querySelector("#businessLogoPreview");
  if (preview) preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Vista previa del logo">`;
  if (status) status.textContent = "Vista previa lista. Pulsa Guardar cambios para subirlo.";
  const rightsWrap = document.querySelector("#businessLogoRightsWrap");
  const rights = document.querySelector("#businessLogoRights");
  if (rightsWrap) rightsWrap.hidden = false;
  if (rights) rights.checked = false;
}

async function uploadPendingBusinessLogo() {
  const input = document.querySelector("#businessLogoFile");
  const file = input?.files?.[0];
  if (!file) return null;
  const rights = document.querySelector("#businessLogoRights");
  if (!rights?.checked) throw new Error("Confirma que tienes derecho a utilizar este logo antes de guardarlo.");
  if (!["image/png","image/jpeg","image/webp"].includes(file.type)) throw new Error("Formato de logo no permitido.");
  if (file.size > 2 * 1024 * 1024) throw new Error("El logo no puede superar 2 MB.");

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${panelBusiness.id}/logo.${ext}`;
  const { error } = await panelCloud.storage.from("business-logos").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600"
  });
  if (error) throw error;
  const { data } = panelCloud.storage.from("business-logos").getPublicUrl(path);
  return { url: `${data.publicUrl}?v=${Date.now()}`, path };
}

async function removeBusinessLogo() {
  if (!panelCloud || !panelBusiness?.id) return;
  const profile = panelBusiness.settings?.business_profile || {};
  const current = profile.logo_path || "";
  try {
    if (current) await panelCloud.storage.from("business-logos").remove([current]);
    const currentSettings = panelBusiness.settings && typeof panelBusiness.settings === "object" ? panelBusiness.settings : {};
    const nextProfile = { ...profile };
    delete nextProfile.logo_url;
    delete nextProfile.logo_path;
    const { data, error } = await panelCloud.from("businesses").update({
      settings: { ...currentSettings, business_profile: nextProfile },
      updated_at: new Date().toISOString()
    }).eq("id", panelBusiness.id).select("*").single();
    if (error) throw error;
    panelBusiness = data;
    renderBusinessSection();
  } catch (error) {
    console.error("No se pudo eliminar el logo:", error);
    showBusinessMessage(error?.message || "No se pudo eliminar el logo.", "error");
  }
}
window.previewBusinessLogo = previewBusinessLogo;
window.removeBusinessLogo = removeBusinessLogo;

async function saveBusinessSettings() {

  if (!panelCloud || !panelBusiness?.id) return;


  const button =
    document.querySelector("#saveBusinessButton");


  const businessName =
    document
      .querySelector("#businessName")
      ?.value
      .trim();


  const businessType =
    document
      .querySelector("#businessType")
      ?.value;


  const phone =
    document
      .querySelector("#businessPhone")
      ?.value
      .trim();


  const whatsapp =
    document
      .querySelector("#businessWhatsapp")
      ?.value
      .trim();


  const email =
    document
      .querySelector("#businessEmail")
      ?.value
      .trim();


  const province =
    document
      .querySelector("#businessProvince")
      ?.value;


  const canton =
    document
      .querySelector("#businessCanton")
      ?.value
      .trim();


  const address =
    document
      .querySelector("#businessAddress")
      ?.value
      .trim();


  if (!businessName) {

    showBusinessMessage(
      "Escribe el nombre de tu negocio.",
      "error"
    );

    return;
  }


  try {

    if (button) {

      button.disabled = true;
      button.textContent = "Guardando...";

    }


    /*
      IMPORTANTE:

      Primero guardamos únicamente las columnas
      principales que ya utiliza PUNTO YA CR.

      Los campos adicionales se incorporarán cuando
      confirmemos que existen en la tabla businesses.
    */

    const currentSettings =
  panelBusiness.settings &&
  typeof panelBusiness.settings === "object" &&
  !Array.isArray(panelBusiness.settings)
    ? panelBusiness.settings
    : {};

const currentBusinessProfile =
  currentSettings.business_profile &&
  typeof currentSettings.business_profile === "object" &&
  !Array.isArray(currentSettings.business_profile)
    ? currentSettings.business_profile
    : {};

const uploadedLogo = await uploadPendingBusinessLogo();
const previousLogoPath = currentBusinessProfile.logo_path || "";

const updates = {
  name: businessName,
  business_type: businessType,

  settings: {
    ...currentSettings,

    business_profile: {
      ...currentBusinessProfile,
      phone,
      whatsapp,
      email,
      province,
      canton,
      address,
      ...(uploadedLogo ? {
        logo_url: uploadedLogo.url,
        logo_path: uploadedLogo.path
      } : {})
    }
  }
};


    const {
      data,
      error
    } = await panelCloud
      .from("businesses")
      .update(updates)
      .eq("id", panelBusiness.id)
      .select("*")
      .single();


    if (error) {
      throw error;
    }


    panelBusiness = data;

    if (uploadedLogo && previousLogoPath && previousLogoPath !== uploadedLogo.path) {
      panelCloud.storage.from("business-logos").remove([previousLogoPath]).catch(() => {});
    }

    /*
      Conservamos temporalmente los datos de contacto
      en memoria para la interfaz.

      No intentamos escribir columnas inexistentes.
    */


    showBusinessMessage(
      "Cambios guardados.",
      "success"
    );


  } catch (error) {

    console.error(
      "No se pudo actualizar el negocio:",
      error
    );


    showBusinessMessage(
      error?.message ||
      "No se pudieron guardar los cambios.",
      "error"
    );


  } finally {

    if (button) {

      button.disabled = false;
      button.textContent = "Guardar cambios";

    }

  }
}


/* =========================================================
   MENSAJE DE GUARDADO
   ========================================================= */

function showBusinessMessage(
  message,
  type = "success"
) {

  const box =
    document.querySelector("#businessSaveMessage");


  if (!box) return;


  box.textContent = message;

  box.className =
    `business-save-message ${type}`;

  box.hidden = false;


  if (type === "success") {

    setTimeout(() => {

      if (box) {
        box.hidden = true;
      }

    }, 3000);

  }
}


window.renderBusinessSection =
  renderBusinessSection;

window.saveBusinessSettings =
  saveBusinessSettings;
/* =========================================================
   MI CUENTA
   Panel del Emprendedor
   ========================================================= */

async function renderAccountSection() {

  if (!panelCloud || !panelUser || !panelBusiness) {
    renderPanelDashboard();
    return;
  }

  let accountMember = null;

  try {

    const { data, error } = await panelCloud
      .from("business_members")
      .select("business_id,user_id,display_name,email,role,active")
      .eq("business_id", panelBusiness.id)
      .eq("user_id", panelUser.id)
      .maybeSingle();

    if (error) throw error;

    accountMember = data;

  } catch (error) {

    console.error(
      "No se pudo cargar Mi cuenta:",
      error
    );

  }


  const displayName =
    accountMember?.display_name ||
    panelUser?.user_metadata?.full_name ||
    panelUser?.user_metadata?.name ||
    "";

  const email =
    panelUser?.email ||
    accountMember?.email ||
    "";

  const businessName =
    panelBusiness?.name ||
    "Mi negocio";


  document.body.innerHTML = `

    <div class="entrepreneur-dashboard">

      <!-- HEADER -->

      <header class="dashboard-header">

        <div class="dashboard-header-inner">

          <button
            type="button"
            class="dashboard-brand dashboard-brand-button"
            onclick="renderPanelDashboard()">

            <img
              src="assets/logo-horizontal.png"
              alt="PUNTO YA CR">

          </button>


          <div class="dashboard-account">

            <div class="dashboard-business-mini">

              <strong>
                ${escapePanelHTML(businessName)}
              </strong>

              <span>
                Panel del Emprendedor
              </span>

            </div>


            <button
              type="button"
              class="dashboard-logout"
              onclick="panelLogout()">

              Cerrar sesión

            </button>

          </div>

        </div>

      </header>



      <!-- CONTENIDO -->

      <main class="dashboard-main account-settings-main">

        <button
          type="button"
          class="business-back"
          onclick="renderPanelDashboard()">

          ← Volver al panel

        </button>


        <section class="business-settings-heading">

          <span class="dashboard-eyebrow">
            MI CUENTA
          </span>

          <h1>
            Tu cuenta
          </h1>

          <p>
            Tus datos y seguridad, sin complicaciones.
          </p>

        </section>



        <section class="business-settings-card">


          <!-- PERFIL -->

          <div class="business-settings-block">

            <div class="business-settings-title">

              <div class="business-settings-icon">
                👤
              </div>

              <div>

                <h2>
                  Tu perfil
                </h2>

                <p>
                  La información asociada a tu cuenta.
                </p>

              </div>

            </div>


            <div class="business-form-grid">

              <div class="business-field">

                <label for="accountDisplayName">
                  Tu nombre
                </label>

                <input
                  id="accountDisplayName"
                  type="text"
                  maxlength="80"
                  autocomplete="name"
                  value="${escapePanelHTML(displayName)}"
                  placeholder="Tu nombre">

              </div>


              <div class="business-field">

                <label for="accountEmail">
                  Correo de acceso
                </label>

                <input
                  id="accountEmail"
                  type="email"
                  value="${escapePanelHTML(email)}"
                  readonly>

                <small class="account-field-help">
                  Este es el correo con el que ingresas a PUNTO YA CR.
                </small>

              </div>

            </div>

          </div>



          <!-- SEGURIDAD -->

          <div class="business-settings-block">

            <div class="business-settings-title">

              <div class="business-settings-icon">
                🔒
              </div>

              <div>

                <h2>
                  Seguridad
                </h2>

                <p>
                  Cambia tu contraseña cuando lo necesites.
                </p>

              </div>

            </div>


            <div class="account-security-row">

              <div>

                <strong>
                  Contraseña
                </strong>

                <p>
                  Usa una contraseña que no utilices en otros servicios.
                </p>

              </div>


              <button
                type="button"
                class="account-secondary-button"
                onclick="showPasswordChange()">

                Cambiar contraseña

              </button>

            </div>


            <div
              id="passwordChangeBox"
              class="password-change-box"
              hidden>

              <div class="business-form-grid">

                <div class="business-field">

                  <label for="accountNewPassword">
                    Nueva contraseña
                  </label>

                  <input
                    id="accountNewPassword"
                    type="password"
                    autocomplete="new-password"
                    minlength="8"
                    placeholder="Mínimo 8 caracteres">

                </div>


                <div class="business-field">

                  <label for="accountConfirmPassword">
                    Confirmar contraseña
                  </label>

                  <input
                    id="accountConfirmPassword"
                    type="password"
                    autocomplete="new-password"
                    minlength="8"
                    placeholder="Repite la contraseña">

                </div>

              </div>


              <div class="password-change-actions">

                <button
                  type="button"
                  class="account-cancel-button"
                  onclick="hidePasswordChange()">

                  Cancelar

                </button>


                <button
                  id="changePasswordButton"
                  type="button"
                  class="business-save-button"
                  onclick="changeAccountPassword()">

                  Actualizar contraseña

                </button>

              </div>

            </div>

          </div>



          <!-- ESTADO -->

          <div class="business-settings-block">

            <div class="business-settings-title">

              <div class="business-settings-icon">
                ✓
              </div>

              <div>

                <h2>
                  Estado de la cuenta
                </h2>

                <p>
                  Tu acceso al negocio.
                </p>

              </div>

            </div>


            <div class="account-status-card">

              <div>

                <span class="account-status-dot"></span>

                <strong>
                  Cuenta activa
                </strong>

              </div>

              <span class="account-owner-badge">
                ${escapePanelHTML(panelMembership?.role === "owner" ? "Propietario" : (panelMembership?.role || "Miembro"))}
              </span>

            </div>

          </div>



          <div
            id="accountSaveMessage"
            class="business-save-message"
            hidden>
          </div>



          <div class="business-settings-actions">

            <button
              id="saveAccountButton"
              type="button"
              class="business-save-button"
              onclick="saveAccountProfile()">

              Guardar cambios

            </button>

          </div>

        </section>


        <p class="business-simple-note">
          PUNTO YA CR · Tu negocio, más simple.
        </p>

      </main>

    </div>

  `;
}


/* =========================================================
   GUARDAR PERFIL
   ========================================================= */

async function saveAccountProfile() {

  if (!panelCloud || !panelUser || !panelBusiness) return;

  const button =
    document.querySelector("#saveAccountButton");

  const displayName =
    document
      .querySelector("#accountDisplayName")
      ?.value
      .trim();


  if (!displayName) {

    showAccountMessage(
      "Escribe tu nombre.",
      "error"
    );

    return;
  }


  try {

    if (button) {
      button.disabled = true;
      button.textContent = "Guardando...";
    }


    const { error } = await panelCloud
      .from("business_members")
      .update({
        display_name: displayName
      })
      .eq("business_id", panelBusiness.id)
      .eq("user_id", panelUser.id);


    if (error) throw error;


    /*
      También actualizamos el nombre en Auth.
      Así la misma cuenta conserva el nombre
      fuera de business_members.
    */

    const {
      data: authData,
      error: authError
    } = await panelCloud.auth.updateUser({

      data: {
        full_name: displayName
      }

    });


    if (authError) throw authError;


    if (authData?.user) {
      panelUser = authData.user;
    }


    showAccountMessage(
      "Cambios guardados.",
      "success"
    );


  } catch (error) {

    console.error(
      "No se pudo actualizar Mi cuenta:",
      error
    );

    showAccountMessage(
      error?.message ||
      "No se pudieron guardar los cambios.",
      "error"
    );


  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "Guardar cambios";
    }

  }
}


/* =========================================================
   CAMBIAR CONTRASEÑA
   ========================================================= */

function showPasswordChange() {

  const box =
    document.querySelector("#passwordChangeBox");

  if (box) {
    box.hidden = false;
  }
}


function hidePasswordChange() {

  const box =
    document.querySelector("#passwordChangeBox");

  const password =
    document.querySelector("#accountNewPassword");

  const confirmPassword =
    document.querySelector("#accountConfirmPassword");


  if (password) password.value = "";
  if (confirmPassword) confirmPassword.value = "";

  if (box) {
    box.hidden = true;
  }
}


async function changeAccountPassword() {

  if (!panelCloud) return;


  const password =
    document
      .querySelector("#accountNewPassword")
      ?.value || "";

  const confirmPassword =
    document
      .querySelector("#accountConfirmPassword")
      ?.value || "";

  const button =
    document.querySelector("#changePasswordButton");


  if (password.length < 8) {

    showAccountMessage(
      "La contraseña debe tener al menos 8 caracteres.",
      "error"
    );

    return;
  }


  if (password !== confirmPassword) {

    showAccountMessage(
      "Las contraseñas no coinciden.",
      "error"
    );

    return;
  }


  try {

    if (button) {
      button.disabled = true;
      button.textContent = "Actualizando...";
    }


    const { error } =
      await panelCloud.auth.updateUser({
        password
      });


    if (error) throw error;


    hidePasswordChange();


    showAccountMessage(
      "Contraseña actualizada.",
      "success"
    );


  } catch (error) {

    console.error(
      "No se pudo cambiar la contraseña:",
      error
    );


    showAccountMessage(
      error?.message ||
      "No se pudo actualizar la contraseña.",
      "error"
    );


  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "Actualizar contraseña";
    }

  }
}


/* =========================================================
   MENSAJES MI CUENTA
   ========================================================= */

function showAccountMessage(
  message,
  type = "success"
) {

  const box =
    document.querySelector("#accountSaveMessage");

  if (!box) return;


  box.textContent = message;

  box.className =
    `business-save-message ${type}`;

  box.hidden = false;


  if (type === "success") {

    setTimeout(() => {

      if (box) {
        box.hidden = true;
      }

    }, 3000);

  }
}


/* =========================================================
   EXPONER FUNCIONES
   ========================================================= */

window.renderAccountSection =
  renderAccountSection;

window.saveAccountProfile =
  saveAccountProfile;

window.showPasswordChange =
  showPasswordChange;

window.hidePasswordChange =
  hidePasswordChange;

window.changeAccountPassword =
  changeAccountPassword;

/* =========================================================
   ESCAPAR TEXTO
   ========================================================= */

function escapePanelHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


window.renderPanelDashboard =
  renderPanelDashboard;

window.openDashboardSection =
  openDashboardSection;


/* =========================================================
   SECCIONES COMPLETAS DEL PANEL
   ========================================================= */

function panelSectionShell(eyebrow, title, description, content) {
  const businessName = panelBusiness?.name || "Mi negocio";
  document.body.innerHTML = `
    <div class="entrepreneur-dashboard">
      <header class="dashboard-header">
        <div class="dashboard-header-inner">
          <button type="button" class="dashboard-brand dashboard-brand-button" onclick="renderPanelDashboard()">
            <img src="assets/logo-horizontal.png" alt="PUNTO YA CR">
          </button>
          <div class="dashboard-account">
            <div class="dashboard-business-mini"><strong>${escapePanelHTML(businessName)}</strong><span>Panel del Emprendedor</span></div>
            <button type="button" class="dashboard-logout" onclick="panelLogout()">Cerrar sesión</button>
          </div>
        </div>
      </header>
      <main class="dashboard-main panel-section-main">
        <button type="button" class="business-back" onclick="renderPanelDashboard()">← Volver al panel</button>
        <section class="business-settings-heading">
          <span class="dashboard-eyebrow">${escapePanelHTML(eyebrow)}</span>
          <h1>${escapePanelHTML(title)}</h1>
          <p>${escapePanelHTML(description)}</p>
        </section>
        ${content}
        <p class="business-simple-note">PUNTO YA CR · Tu negocio, más simple.</p>
      </main>
    </div>`;
}

function renderDevicesSection() {
  if (!panelUser || !panelBusiness) return renderPanelDashboard();
  const lastSignIn = panelUser.last_sign_in_at
    ? new Date(panelUser.last_sign_in_at).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })
    : "Sesión activa";
  const browser = navigator.userAgent.includes("Mobile") ? "Dispositivo móvil" : "Computadora / navegador";
  panelSectionShell(
    "DISPOSITIVOS",
    "Tus accesos",
    "Revisa la sesión que estás utilizando y el estado de sincronización.",
    `<section class="business-settings-card">
      <div class="business-settings-block">
        <div class="business-settings-title"><div class="business-settings-icon">▣</div><div><h2>Este dispositivo</h2><p>La sesión con la que estás usando el Panel del Emprendedor.</p></div></div>
        <div class="account-status-card"><div><span class="account-status-dot"></span><div><strong>${escapePanelHTML(browser)}</strong><p class="panel-inline-note">Último acceso: ${escapePanelHTML(lastSignIn)}</p></div></div><span class="account-owner-badge">Activo</span></div>
      </div>
      <div class="business-settings-block">
        <div class="business-settings-title"><div class="business-settings-icon">↻</div><div><h2>Sincronización</h2><p>Tu cuenta está conectada a PUNTO YA CR.</p></div></div>
        <div class="panel-info-card"><strong>Conectado con la nube</strong><p>Los datos compatibles con tu plan se mantienen asociados a tu cuenta y negocio.</p></div>
      </div>
      <div class="business-settings-actions"><a class="business-save-button panel-link-button" href="${PUNTO_YA_APP}">Abrir PUNTO YA CR</a></div>
    </section>`
  );
}

function getFiscalProfile() {
  const settings = panelBusiness?.settings;
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings.fiscal_profile || {}) : {};
}

function renderBillingSection() {
  if (!panelBusiness) return renderPanelDashboard();
  const fiscal = getFiscalProfile();
  panelSectionShell(
    "FACTURACIÓN",
    "Facturación electrónica",
    "Administra los datos fiscales de tu negocio. La emisión de comprobantes se realiza desde PUNTO YA CR.",
    `<section class="business-settings-card">
      <div class="business-settings-block">
        <div class="business-settings-title"><div class="business-settings-icon">₡</div><div><h2>Datos fiscales</h2><p>Información que identifica a tu negocio para facturación.</p></div></div>
        <div class="business-form-grid">
          <div class="business-field"><label for="fiscalLegalName">Nombre o razón social</label><input id="fiscalLegalName" value="${escapePanelHTML(fiscal.legal_name || panelBusiness.name || "")}" placeholder="Nombre o razón social"></div>
          <div class="business-field"><label for="fiscalIdType">Tipo de identificación</label><select id="fiscalIdType"><option value="fisica" ${fiscal.id_type === "fisica" ? "selected" : ""}>Cédula física</option><option value="juridica" ${fiscal.id_type === "juridica" ? "selected" : ""}>Cédula jurídica</option><option value="dimex" ${fiscal.id_type === "dimex" ? "selected" : ""}>DIMEX</option><option value="nite" ${fiscal.id_type === "nite" ? "selected" : ""}>NITE</option></select></div>
          <div class="business-field"><label for="fiscalIdNumber">Número de identificación</label><input id="fiscalIdNumber" value="${escapePanelHTML(fiscal.id_number || "")}" inputmode="numeric" placeholder="Número de identificación"></div>
          <div class="business-field"><label for="fiscalEmail">Correo para comprobantes</label><input id="fiscalEmail" type="email" value="${escapePanelHTML(fiscal.email || "")}" placeholder="facturacion@negocio.com"></div>
          <div class="business-field"><label for="fiscalActivity">Actividad económica</label><input id="fiscalActivity" value="${escapePanelHTML(fiscal.activity || "")}" placeholder="Actividad económica"></div>
          <div class="business-field"><label for="fiscalUsesEInvoice">¿Utiliza factura electrónica?</label><select id="fiscalUsesEInvoice"><option value="no" ${!fiscal.uses_einvoice ? "selected" : ""}>No</option><option value="yes" ${fiscal.uses_einvoice ? "selected" : ""}>Sí</option></select></div>
        </div>
      </div>
      <div id="billingSaveMessage" class="business-save-message" hidden></div>
      <div class="business-settings-actions"><button id="saveBillingButton" type="button" class="business-save-button" onclick="saveBillingSettings()">Guardar cambios</button></div>
    </section>`
  );
}

async function saveBillingSettings() {
  if (!panelCloud || !panelBusiness) return;
  const button = document.querySelector("#saveBillingButton");
  const currentSettings = panelBusiness.settings && typeof panelBusiness.settings === "object" && !Array.isArray(panelBusiness.settings) ? panelBusiness.settings : {};
  const fiscal_profile = {
    ...(currentSettings.fiscal_profile || {}),
    legal_name: document.querySelector("#fiscalLegalName")?.value.trim() || "",
    id_type: document.querySelector("#fiscalIdType")?.value || "fisica",
    id_number: document.querySelector("#fiscalIdNumber")?.value.trim() || "",
    email: document.querySelector("#fiscalEmail")?.value.trim() || "",
    activity: document.querySelector("#fiscalActivity")?.value.trim() || "",
    uses_einvoice: document.querySelector("#fiscalUsesEInvoice")?.value === "yes"
  };
  try {
    if (button) { button.disabled = true; button.textContent = "Guardando..."; }
    const { data, error } = await panelCloud.from("businesses").update({ settings: { ...currentSettings, fiscal_profile }, updated_at: new Date().toISOString() }).eq("id", panelBusiness.id).select("*").single();
    if (error) throw error;
    panelBusiness = data;
    showPanelSectionMessage("billingSaveMessage", "Cambios guardados.", "success");
  } catch (error) {
    console.error("No se pudo guardar Facturación:", error);
    showPanelSectionMessage("billingSaveMessage", error?.message || "No se pudieron guardar los cambios.", "error");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Guardar cambios"; }
  }
}

async function renderPlanSection() {
  if (!panelBusiness) return renderPanelDashboard();
  let plan = null;
  try {
    const { data, error } = await panelCloud.from("business_plans").select("plan_tier,plan_source,plan_period,starts_at,expires_at,updated_at").eq("business_id", panelBusiness.id).maybeSingle();
    if (!error) plan = data;
  } catch (_) {}
  const isPro = panelPlanIsActive(plan);
  const tier = isPro ? "pro" : "free";
  const canManagePlan = panelMembership?.role === "owner" || panelBusiness.owner_user_id === panelUser?.id;
  const expires = plan?.expires_at ? new Date(plan.expires_at).toLocaleDateString("es-CR", { dateStyle: "medium" }) : "Sin fecha definida";
  panelSectionShell(
    "PLAN ACTUAL",
    isPro ? "PUNTO YA CR Pro" : "PUNTO YA CR Free",
    "Consulta el estado de tu plan y las funciones asociadas a tu negocio.",
    `<section class="business-settings-card">
      <div class="business-settings-block">
        <div class="business-settings-title"><div class="business-settings-icon">✦</div><div><h2>${isPro ? "Plan Pro" : "Plan Free"}</h2><p>${isPro ? "Tu negocio tiene acceso a las funciones Pro habilitadas." : "Tu negocio está utilizando el plan gratuito."}</p></div></div>
        <div class="account-status-card"><div><span class="account-status-dot"></span><strong>${isPro ? "Pro activo" : "Free activo"}</strong></div><span class="account-owner-badge">${isPro ? "PRO" : "FREE"}</span></div>
        ${isPro ? `<p class="panel-plan-date">Vigencia: ${escapePanelHTML(expires)}</p>` : (String(plan?.plan_tier||'').toLowerCase()==='pro' && plan?.expires_at ? `<p class="panel-plan-date">Tu período PRO venció el ${escapePanelHTML(expires)}.</p>` : "")}
      </div>
      <div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">✓</div><div><h2>Tu plan, claro</h2><p>El Panel muestra el plan registrado para este negocio.</p></div></div><div class="panel-info-card"><strong>PRO: ₡6.990 mensual · ₡18.900 trimestral · ₡69.900 anual</strong><p>Precios finales con impuestos incluidos. Los pagos en línea se habilitarán cuando conectemos la pasarela oficial.</p></div></div>
      ${canManagePlan ? `<div class="code-activation-box"><div class="business-settings-title"><div class="business-settings-icon">⌁</div><div><h2>Activar código PRO</h2><p>Usa aquí un código del Programa Fundadores, regalo o promoción. Si ya tienes PRO vigente, el tiempo del código se suma a tu vigencia.</p></div></div><div class="code-row"><input id="proActivationCode" autocomplete="off" autocapitalize="characters" maxlength="32" placeholder="PYCR-XXXX-XXXX" aria-label="Código de activación PRO"><button id="redeemProButton" class="business-save-button" type="button" onclick="redeemProCode()">Activar PRO</button></div><div id="proCodeMessage" class="code-message" role="status" aria-live="polite"></div></div>` : `<div class="panel-info-card"><strong>Administración del plan</strong><p>Solo el propietario del negocio puede activar códigos o cambiar el plan.</p></div>`}
      <div class="business-settings-actions"><a class="business-save-button panel-link-button" href="${PUNTO_YA_APP}">Abrir PUNTO YA CR</a></div>
    </section>`
  );
}

function renderSupportSection() {
  panelSectionShell(
    "SOPORTE",
    "¿En qué te ayudamos?",
    "Accesos rápidos para resolver las dudas más comunes sin complicaciones.",
    `<section class="business-settings-card">
      <div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">?</div><div><h2>Ayuda rápida</h2><p>Empieza por la opción relacionada con lo que necesitas.</p></div></div>
        <div class="panel-support-grid">
          <button type="button" class="panel-support-item" onclick="openDashboardSection('account')"><strong>Cuenta y contraseña</strong><span>Perfil, acceso y seguridad →</span></button>
          <button type="button" class="panel-support-item" onclick="openDashboardSection('business')"><strong>Datos del negocio</strong><span>Contacto, ubicación y negocio →</span></button>
          <button type="button" class="panel-support-item" onclick="openDashboardSection('billing')"><strong>Facturación</strong><span>Datos fiscales →</span></button>
          <a class="panel-support-item" href="${PUNTO_YA_APP}"><strong>Punto de venta</strong><span>Abrir PUNTO YA CR →</span></a>
        </div>
      </div>
      <div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">i</div><div><h2>Información de soporte</h2><p>No mostramos un teléfono o correo de soporte hasta que se configure uno oficial para PUNTO YA CR.</p></div></div></div>
    </section>`
  );
}

function showPanelSectionMessage(id, message, type = "success") {
  const box = document.getElementById(id);
  if (!box) return;
  box.textContent = message;
  box.className = `business-save-message ${type}`;
  box.hidden = false;
}

window.renderDevicesSection = renderDevicesSection;
window.renderBillingSection = renderBillingSection;
window.saveBillingSettings = saveBillingSettings;
window.renderPlanSection = renderPlanSection;
window.renderSupportSection = renderSupportSection;


/* =========================================================
   PRO: DINERO · CRECIMIENTO · CONTABILIDAD
   Sin IA. Solo datos y reglas verificables.
   ========================================================= */
function panelProShell(title, eyebrow, intro, body) {
  const name=panelBusiness?.name||"Mi negocio";
  document.body.innerHTML=`<div class="entrepreneur-dashboard plan-pro"><header class="dashboard-header"><div class="dashboard-header-inner"><button class="dashboard-brand dashboard-brand-button" onclick="renderPanelDashboard()"><img src="assets/logo-horizontal.png" alt="PUNTO YA CR"></button><div class="dashboard-account"><div class="dashboard-business-mini"><strong>${escapePanelHTML(name)}</strong><span>PUNTO YA CR Pro</span></div><button class="dashboard-logout" onclick="panelLogout()">Cerrar sesión</button></div></div></header><main class="dashboard-main pro-detail-main"><button class="business-back" onclick="renderPanelDashboard()">← Volver al panel</button><section class="business-settings-heading"><span class="dashboard-eyebrow">${eyebrow}</span><h1>${title}</h1><p>${intro}</p></section>${body}<p class="business-simple-note">PUNTO YA CR · Tu negocio, más simple.</p></main></div>`;
}

async function redeemProCode(){
  const input=document.getElementById("proActivationCode"), msg=document.getElementById("proCodeMessage"), button=document.getElementById("redeemProButton");
  if(!input||!msg||!panelBusiness)return;
  const code=String(input.value||"").trim().toUpperCase();
  if(code.length<8){msg.className="code-message error";msg.textContent="Ingresa un código válido.";return;}
  msg.className="code-message";msg.textContent="Validando código…";
  if(button){button.disabled=true;button.textContent="Activando…";}
  try{
    const {data,error}=await panelCloud.rpc("redeem_pro_code",{p_business_id:panelBusiness.id,p_code:code});
    if(error)throw error;
    if(!data?.ok){msg.className="code-message error";msg.textContent=data?.message||"No se pudo activar el código.";return;}
    clearEntrepreneurSnapshotCache();
    msg.className="code-message ok";msg.textContent=data.message||"PUNTO YA CR Pro activado.";
    setTimeout(()=>renderPlanSection(),900);
  }catch(e){msg.className="code-message error";msg.textContent=e?.message||"No se pudo validar el código.";}
  finally{if(button){button.disabled=false;button.textContent="Activar PRO";}}
}

window.redeemProCode=redeemProCode;
async function requireProData(){
  const d=await loadEntrepreneurSnapshot("full");
  if(String(d.planTier)!=="pro"){ await renderPlanSection(); return null; }
  return {d,m:buildEntrepreneurMetrics(d)};
}

function panelDate(value){
  if(!value) return "—";
  const d=new Date(String(value).length===10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("es-CR",{dateStyle:"medium"});
}

function panelInvoiceBalance(invoice,payments=[]){
  if(String(invoice?.condition||"").toLowerCase()!=="credit") return 0;
  const total=Number(invoice?.total||0);
  const paid=payments.filter(p=>p.invoice_id===invoice.id).reduce((a,p)=>a+Number(p.amount||0),0);
  const computed=Math.max(0,total-paid);
  const stored=Math.max(0,Number(invoice?.balance_due||0));
  if(paid>0) return Math.min(stored>0?stored:computed,computed);
  return stored>0?stored:computed;
}

async function renderMoneySection(){
  const x=await requireProData(); if(!x)return;
  const {d,m}=x; window.__panelMoneyData=d;
  const supplierMap=new Map((d.suppliers||[]).map(r=>[r.id,r]));
  const expenses=(d.expenses||[]).slice(0,8).map(r=>`<div class="ledger-row"><span><strong>${escapePanelHTML(r.description||r.category||"Gasto")}</strong><small>${escapePanelHTML(panelDate(r.expense_date||r.created_at))} · ${String(r.condition||"cash")==="credit"?"Crédito":"Contado"}</small></span><b>${panelMoney(r.total)}</b></div>`).join("")||'<p class="panel-empty">Todavía no hay gastos registrados.</p>';
  const suppliers=(d.suppliers||[]).filter(r=>r.active!==false).slice(0,8).map(r=>`<div class="ledger-row"><span><strong>${escapePanelHTML(r.name||"Proveedor")}</strong><small>${escapePanelHTML(r.phone||r.email||r.tax_id||"")}</small></span><b>${Number(r.usual_credit_days||0)?`${Number(r.usual_credit_days)} días`:""}</b></div>`).join("")||'<p class="panel-empty">Aún no hay proveedores registrados.</p>';
  const invoices=(d.supplierInvoices||[]).filter(r=>!r.voided).slice(0,10).map(r=>{
    const balance=panelInvoiceBalance(r,d.supplierPayments||[]), supplier=supplierMap.get(r.supplier_id);
    return `<div class="ledger-row invoice-row"><span><strong>${escapePanelHTML(r.document_number||supplier?.name||"Factura de proveedor")}</strong><small>${escapePanelHTML(supplier?.name||"Proveedor")} · ${escapePanelHTML(panelDate(r.invoice_date))}${r.due_date?` · vence ${escapePanelHTML(panelDate(r.due_date))}`:""}</small></span><div class="ledger-actions"><b>${panelMoney(balance)}</b>${balance>0?`<button class="mini-action" onclick="showSupplierPaymentForm('${r.id}')">Abonar</button>`:"<small>Pagada</small>"}</div></div>`;
  }).join("")||'<p class="panel-empty">Aún no hay facturas de proveedor registradas.</p>';

  panelProShell("Dinero","DINERO PRO","Lo que entra, lo que sale y lo que todavía está pendiente.",`
    <section class="metric-grid">
      <article class="metric-card hero"><span>Ventas · 30 días</span><strong>${panelMoney(m.monthRevenue)}</strong><small>${panelTrendText(m.monthPct)}</small></article>
      <article class="metric-card"><span>Gastos · 30 días</span><strong>${panelMoney(m.expenseTotal)}</strong><small>Registrados</small></article>
      <article class="metric-card"><span>Por cobrar</span><strong>${panelMoney(m.credit)}</strong><small>Clientes</small></article>
      <article class="metric-card"><span>Por pagar</span><strong>${panelMoney(m.payable)}</strong><small>${m.overdue?panelMoney(m.overdue)+" vencido":"Sin vencidos"}</small></article>
    </section>
    <section class="panel-business-grid">
      <article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">GASTOS</span><h2>Gastos recientes</h2></div><button class="mini-action" onclick="showExpenseForm()">+ Registrar</button></div>${expenses}</article>
      <article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">COMPROMISOS</span><h2>Dinero pendiente</h2></div></div><div class="money-line"><span>Clientes te deben</span><strong>${panelMoney(m.credit)}</strong></div><div class="money-line"><span>Debes a proveedores</span><strong>${panelMoney(m.payable)}</strong></div><div class="money-line"><span>Vencido</span><strong>${panelMoney(m.overdue)}</strong></div></article>
    </section>
    <section class="panel-business-grid finance-management-grid">
      <article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">PROVEEDORES</span><h2>Proveedores</h2></div><button class="mini-action" onclick="showSupplierForm()">+ Agregar</button></div>${suppliers}</article>
      <article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">FACTURAS</span><h2>Compras y crédito</h2></div><button class="mini-action" onclick="showSupplierInvoiceForm()">+ Factura</button></div>${invoices}</article>
    </section>
    <div id="financeFormMount"></div>`);
}

function showExpenseForm(){
  const m=document.querySelector('#financeFormMount'); if(!m)return;
  m.innerHTML=`<section class="business-settings-card finance-form"><div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">₡</div><div><h2>Registrar gasto</h2><p>Para servicios, alquiler, transporte y otros gastos del negocio.</p></div></div><div class="business-form-grid"><div class="business-field"><label>Descripción</label><input id="expDesc" maxlength="160"></div><div class="business-field"><label>Categoría</label><input id="expCat" maxlength="80" placeholder="Electricidad, alquiler, transporte…"></div><div class="business-field"><label>Total</label><input id="expTotal" type="number" min="0" step="0.01" inputmode="decimal"></div><div class="business-field"><label>Condición</label><select id="expCondition"><option value="cash">Contado</option><option value="credit">Crédito</option></select></div><div class="business-field"><label>Fecha</label><input id="expDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="business-field"><label>Vencimiento (si aplica)</label><input id="expDue" type="date"></div></div><div class="business-settings-actions"><button id="saveExpenseButton" class="business-save-button" onclick="saveExpense()">Guardar gasto</button></div><div id="financeMessage" class="business-save-message" hidden></div></div></section>`;
  m.scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveExpense(){
  if(!panelCloud||!panelBusiness)return;
  const row={business_id:panelBusiness.id,description:document.querySelector('#expDesc')?.value.trim(),category:document.querySelector('#expCat')?.value.trim(),total:Number(document.querySelector('#expTotal')?.value||0),condition:document.querySelector('#expCondition')?.value||'cash',expense_date:document.querySelector('#expDate')?.value,due_date:document.querySelector('#expDue')?.value||null};
  const box=document.querySelector('#financeMessage'),button=document.querySelector('#saveExpenseButton');
  if(!row.description||row.total<=0){if(box){box.hidden=false;box.className='business-save-message error';box.textContent='Completa descripción y monto.'}return;}
  try{if(button){button.disabled=true;button.textContent='Guardando…';}const {error}=await panelCloud.from('business_expenses').insert(row);if(error)throw error;clearEntrepreneurSnapshotCache();await renderMoneySection();}
  catch(error){if(box){box.hidden=false;box.className='business-save-message error';box.textContent=error?.message||'No se pudo guardar el gasto.';}}
  finally{if(button){button.disabled=false;button.textContent='Guardar gasto';}}
}

function showSupplierForm(){
  const m=document.querySelector('#financeFormMount');if(!m)return;
  m.innerHTML=`<section class="business-settings-card finance-form"><div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">▤</div><div><h2>Nuevo proveedor</h2><p>Guarda los datos básicos para controlar compras y crédito.</p></div></div><div class="business-form-grid"><div class="business-field"><label>Nombre</label><input id="supName" maxlength="120"></div><div class="business-field"><label>Cédula / identificación</label><input id="supTaxId" maxlength="40"></div><div class="business-field"><label>Teléfono</label><input id="supPhone" maxlength="40"></div><div class="business-field"><label>Correo</label><input id="supEmail" type="email" maxlength="160"></div><div class="business-field"><label>Contacto</label><input id="supContact" maxlength="120"></div><div class="business-field"><label>Días de crédito habituales</label><input id="supDays" type="number" min="0" max="365" value="30"></div></div><div class="business-settings-actions"><button id="saveSupplierButton" class="business-save-button" onclick="saveSupplier()">Guardar proveedor</button></div><div id="financeMessage" class="business-save-message" hidden></div></div></section>`;
  m.scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveSupplier(){
  const box=document.querySelector('#financeMessage'),button=document.querySelector('#saveSupplierButton');
  const row={business_id:panelBusiness.id,name:document.querySelector('#supName')?.value.trim(),tax_id:document.querySelector('#supTaxId')?.value.trim()||null,phone:document.querySelector('#supPhone')?.value.trim()||null,email:document.querySelector('#supEmail')?.value.trim().toLowerCase()||null,contact_name:document.querySelector('#supContact')?.value.trim()||null,usual_credit_days:Number(document.querySelector('#supDays')?.value||0),active:true};
  if(!row.name){if(box){box.hidden=false;box.className='business-save-message error';box.textContent='Escribe el nombre del proveedor.';}return;}
  try{if(button){button.disabled=true;button.textContent='Guardando…';}const {error}=await panelCloud.from('business_suppliers').insert(row);if(error)throw error;clearEntrepreneurSnapshotCache();await renderMoneySection();}
  catch(error){if(box){box.hidden=false;box.className='business-save-message error';box.textContent=error?.message||'No se pudo guardar el proveedor.';}}
  finally{if(button){button.disabled=false;button.textContent='Guardar proveedor';}}
}

function showSupplierInvoiceForm(){
  const d=window.__panelMoneyData||{},m=document.querySelector('#financeFormMount');if(!m)return;
  const options=(d.suppliers||[]).filter(r=>r.active!==false).map(r=>`<option value="${r.id}">${escapePanelHTML(r.name)}</option>`).join('');
  if(!options){m.innerHTML='<section class="business-settings-card finance-form"><div class="business-settings-block"><h2>Primero agrega un proveedor</h2><p>Necesitas un proveedor para registrar su factura.</p><button class="business-save-button" onclick="showSupplierForm()">Agregar proveedor</button></div></section>';return;}
  const today=new Date().toISOString().slice(0,10);
  m.innerHTML=`<section class="business-settings-card finance-form"><div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">▤</div><div><h2>Factura de proveedor</h2><p>Registra compras de contado o a crédito.</p></div></div><div class="business-form-grid"><div class="business-field"><label>Proveedor</label><select id="invSupplier">${options}</select></div><div class="business-field"><label>Número de documento</label><input id="invNumber" maxlength="80"></div><div class="business-field"><label>Fecha</label><input id="invDate" type="date" value="${today}"></div><div class="business-field"><label>Condición</label><select id="invCondition"><option value="credit">Crédito</option><option value="cash">Contado</option></select></div><div class="business-field"><label>Vencimiento</label><input id="invDue" type="date"></div><div class="business-field"><label>Subtotal</label><input id="invSubtotal" type="number" min="0" step="0.01"></div><div class="business-field"><label>Impuesto</label><input id="invTax" type="number" min="0" step="0.01" value="0"></div><div class="business-field"><label>Total</label><input id="invTotal" type="number" min="0" step="0.01"></div></div><div class="business-settings-actions"><button id="saveInvoiceButton" class="business-save-button" onclick="saveSupplierInvoice()">Guardar factura</button></div><div id="financeMessage" class="business-save-message" hidden></div></div></section>`;
  const subtotal=document.querySelector('#invSubtotal'),tax=document.querySelector('#invTax'),total=document.querySelector('#invTotal');
  const recalc=()=>{if(total&&!total.dataset.manual)total.value=(Number(subtotal?.value||0)+Number(tax?.value||0)).toFixed(2)};subtotal?.addEventListener('input',recalc);tax?.addEventListener('input',recalc);total?.addEventListener('input',()=>total.dataset.manual='1');
  m.scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveSupplierInvoice(){
  const box=document.querySelector('#financeMessage'),button=document.querySelector('#saveInvoiceButton');
  const subtotal=Number(document.querySelector('#invSubtotal')?.value||0),tax=Number(document.querySelector('#invTax')?.value||0),entered=Number(document.querySelector('#invTotal')?.value||0),total=entered>0?entered:subtotal+tax,condition=document.querySelector('#invCondition')?.value||'credit';
  const row={business_id:panelBusiness.id,supplier_id:document.querySelector('#invSupplier')?.value||null,document_number:document.querySelector('#invNumber')?.value.trim()||null,invoice_date:document.querySelector('#invDate')?.value||new Date().toISOString().slice(0,10),due_date:document.querySelector('#invDue')?.value||null,condition,subtotal,discount:0,tax,total,balance_due:condition==='credit'?total:0,currency:'CRC'};
  if(!row.supplier_id||total<=0){if(box){box.hidden=false;box.className='business-save-message error';box.textContent='Selecciona proveedor y escribe un total válido.';}return;}
  if(condition==='credit'&&!row.due_date){if(box){box.hidden=false;box.className='business-save-message error';box.textContent='Para una factura a crédito indica la fecha de vencimiento.';}return;}
  try{if(button){button.disabled=true;button.textContent='Guardando…';}const {error}=await panelCloud.from('supplier_invoices').insert(row);if(error)throw error;clearEntrepreneurSnapshotCache();await renderMoneySection();}
  catch(error){if(box){box.hidden=false;box.className='business-save-message error';box.textContent=error?.message||'No se pudo guardar la factura.';}}
  finally{if(button){button.disabled=false;button.textContent='Guardar factura';}}
}

function showSupplierPaymentForm(invoiceId){
  const d=window.__panelMoneyData||{},m=document.querySelector('#financeFormMount');if(!m)return;
  const invoice=(d.supplierInvoices||[]).find(r=>r.id===invoiceId);if(!invoice)return;
  const supplier=(d.suppliers||[]).find(r=>r.id===invoice.supplier_id),balance=panelInvoiceBalance(invoice,d.supplierPayments||[]);
  m.innerHTML=`<section class="business-settings-card finance-form"><div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">₡</div><div><h2>Registrar abono</h2><p>${escapePanelHTML(supplier?.name||'Proveedor')} · saldo ${panelMoney(balance)}</p></div></div><div class="business-form-grid"><div class="business-field"><label>Monto</label><input id="payAmount" type="number" min="0.01" max="${balance}" step="0.01" value="${balance}"></div><div class="business-field"><label>Fecha</label><input id="payDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="business-field"><label>Método</label><select id="payMethod"><option value="SINPE">SINPE / transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="other">Otro</option></select></div><div class="business-field"><label>Referencia</label><input id="payReference" maxlength="100"></div></div><div class="business-settings-actions"><button id="savePaymentButton" class="business-save-button" onclick="saveSupplierPayment('${invoiceId}')">Guardar abono</button></div><div id="financeMessage" class="business-save-message" hidden></div></div></section>`;
  m.scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveSupplierPayment(invoiceId){
  const d=window.__panelMoneyData||{},invoice=(d.supplierInvoices||[]).find(r=>r.id===invoiceId),box=document.querySelector('#financeMessage'),button=document.querySelector('#savePaymentButton');if(!invoice)return;
  const balance=panelInvoiceBalance(invoice,d.supplierPayments||[]),amount=Number(document.querySelector('#payAmount')?.value||0);
  if(amount<=0||amount>balance+0.001){if(box){box.hidden=false;box.className='business-save-message error';box.textContent=`El abono debe ser mayor a 0 y no superar ${panelMoney(balance)}.`;}return;}
  const row={business_id:panelBusiness.id,invoice_id:invoiceId,amount,method:document.querySelector('#payMethod')?.value||null,payment_date:document.querySelector('#payDate')?.value||new Date().toISOString().slice(0,10),reference:document.querySelector('#payReference')?.value.trim()||null};
  try{if(button){button.disabled=true;button.textContent='Guardando…';}const {error}=await panelCloud.from('supplier_payments').insert(row);if(error)throw error;const newBalance=Math.max(0,balance-amount);const {error:updateError}=await panelCloud.from('supplier_invoices').update({balance_due:newBalance}).eq('id',invoiceId).eq('business_id',panelBusiness.id);if(updateError)console.warn('El pago se guardó, pero no se actualizó balance_due:',updateError.message);clearEntrepreneurSnapshotCache();await renderMoneySection();}
  catch(error){if(box){box.hidden=false;box.className='business-save-message error';box.textContent=error?.message||'No se pudo guardar el abono.';}}
  finally{if(button){button.disabled=false;button.textContent='Guardar abono';}}
}

async function renderGrowthSection(){
  const x=await requireProData(); if(!x)return; const {d,m}=x;
  const goal=(d.growthGoals||[]).find(g=>g.active!==false); window.__panelGrowthGoalId=goal?.id||null;
  const target=Number(goal?.target_amount||0),progress=target?Math.min(100,(m.monthRevenue/target)*100):0;
  const health=[['Ventas',m.monthPct>2?'Mejorando ↑':m.monthPct<-2?'Atención ↓':'Estable →'],['Rentabilidad',m.netBeforeOther>0?'Positiva ✓':'Revisar ⚠'],['Inventario',m.lowStock.length?'Atención ⚠':'Bien ✓'],['Por cobrar',m.credit>0?'Revisar':'Bien ✓'],['Por pagar',m.overdue>0?'Atención ⚠':'Bien ✓']];
  const opp=[];if(m.monthPct>5)opp.push(`Tus ventas crecieron ${Math.abs(m.monthPct).toFixed(0)}% frente al período anterior.`);if(m.lowStock.length)opp.push(`${m.lowStock.length} productos con stock bajo pueden frenar ventas.`);if(m.overdue)opp.push(`Tienes ${panelMoney(m.overdue)} vencidos con proveedores.`);if(m.credit)opp.push(`Hay ${panelMoney(m.credit)} pendientes por cobrar.`);if(!opp.length)opp.push('Aún no hay una señal importante que requiera atención.');
  panelProShell("Crecimiento","CRECIMIENTO PRO","Entiende cómo cambia tu negocio y qué conviene revisar.",`<section class="metric-grid"><article class="metric-card hero"><span>Crecimiento · 30 días</span><strong>${m.monthPct>=0?'+':''}${m.monthPct.toFixed(0)}%</strong><small>vs. período anterior</small></article><article class="metric-card"><span>Ventas</span><strong>${panelMoney(m.monthRevenue)}</strong><small>30 días</small></article><article class="metric-card"><span>Margen estimado</span><strong>${panelMoney(m.netBeforeOther)}</strong><small>Con costos/gastos registrados</small></article><article class="metric-card"><span>Clientes</span><strong>${m.clientCount}</strong><small>Registrados</small></article></section><section class="panel-business-grid"><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">SALUD</span><h2>Salud del negocio</h2></div></div>${health.map(([a,b])=>`<div class="money-line"><span>${a}</span><strong>${b}</strong></div>`).join('')}</article><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">OPORTUNIDADES</span><h2>Qué conviene revisar</h2></div></div>${opp.map(o=>`<div class="rule-insight">${escapePanelHTML(o)}</div>`).join('')}</article></section><section class="business-settings-card growth-goal-card"><div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">🎯</div><div><h2>Meta de ventas</h2><p>${target?`Meta actual ${panelMoney(target)}`:'Define una meta mensual para seguir tu avance.'}</p></div></div>${target?`<div class="goal-progress big"><i style="width:${progress}%"></i></div><p>${progress.toFixed(0)}% alcanzado · ${panelMoney(Math.max(0,target-m.monthRevenue))} por completar</p>`:''}<div class="business-form-grid"><div class="business-field"><label>Nueva meta mensual</label><input id="goalAmount" type="number" min="0" placeholder="Ej. 3000000" value="${target||''}"></div></div><div class="business-settings-actions"><button id="saveGoalButton" class="business-save-button" onclick="saveGrowthGoal()">${target?'Actualizar meta':'Guardar meta'}</button></div><div id="goalMessage" class="business-save-message" hidden></div></div></section><section class="business-settings-card simulator-card"><div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">↗</div><div><h2>Simulador</h2><p>Estimaciones matemáticas, no predicciones.</p></div></div><div class="business-form-grid"><div class="business-field"><label>Si aumentas tu ticket promedio (%)</label><input id="simPct" type="number" value="5"></div><div class="business-field"><label>Resultado estimado mensual</label><input id="simResult" readonly value="${panelMoney(m.monthRevenue*1.05)}"></div></div><button class="account-secondary-button" onclick="runGrowthSimulation()">Calcular</button></div></section>`);
}

async function saveGrowthGoal(){
  const v=Number(document.querySelector('#goalAmount')?.value||0),box=document.querySelector('#goalMessage'),button=document.querySelector('#saveGoalButton');if(v<=0){if(box){box.hidden=false;box.className='business-save-message error';box.textContent='Escribe una meta mayor a 0.';}return;}
  try{if(button){button.disabled=true;button.textContent='Guardando…';}let q;if(window.__panelGrowthGoalId)q=panelCloud.from('business_growth_goals').update({target_amount:v,period_start:new Date().toISOString().slice(0,7)+'-01',active:true}).eq('id',window.__panelGrowthGoalId).eq('business_id',panelBusiness.id);else q=panelCloud.from('business_growth_goals').insert({business_id:panelBusiness.id,goal_type:'sales_monthly',target_amount:v,period_start:new Date().toISOString().slice(0,7)+'-01',active:true});const {error}=await q;if(error)throw error;clearEntrepreneurSnapshotCache();await renderGrowthSection();}
  catch(error){if(box){box.hidden=false;box.className='business-save-message error';box.textContent=error?.message||'No se pudo guardar la meta.';}}
  finally{if(button){button.disabled=false;button.textContent='Guardar meta';}}
}

function runGrowthSimulation(){const p=Number(document.querySelector('#simPct')?.value||0),m=window.__panelMetrics;if(document.querySelector('#simResult')&&m)document.querySelector('#simResult').value=panelMoney(m.monthRevenue*(1+p/100));}

async function renderAccountingSection(){
  const x=await requireProData();if(!x)return;const {d,m}=x;window.__panelAccountingData=d;window.__panelAccountingMetrics=m;
  const accountant=d.accountant,supplierMap=new Map((d.suppliers||[]).map(r=>[r.id,r.name||'Proveedor']));
  const suppliers=(d.suppliers||[]).slice(0,6).map(r=>`<div class="ledger-row"><span><strong>${escapePanelHTML(r.name||'Proveedor')}</strong><small>${escapePanelHTML(r.phone||r.email||'')}</small></span><b>→</b></div>`).join('')||'<p class="panel-empty">Aún no hay proveedores registrados.</p>';
  const latestInvoices=(d.supplierInvoices||[]).filter(r=>!r.voided).slice(0,5).map(r=>`<div class="ledger-row"><span><strong>${escapePanelHTML(r.document_number||supplierMap.get(r.supplier_id)||'Factura')}</strong><small>${escapePanelHTML(panelDate(r.invoice_date))}</small></span><b>${panelMoney(r.total)}</b></div>`).join('')||'<p class="panel-empty">Aún no hay compras registradas.</p>';
  panelProShell("Contabilidad","CONTABILIDAD PRO","Todo organizado para revisar tu negocio y preparar la información para tu contador.",`<section class="metric-grid"><article class="metric-card hero"><span>Ventas · 30 días</span><strong>${panelMoney(m.monthRevenue)}</strong><small>${m.monthCount} ventas</small></article><article class="metric-card"><span>Gastos</span><strong>${panelMoney(m.expenseTotal)}</strong><small>30 días</small></article><article class="metric-card"><span>Por cobrar</span><strong>${panelMoney(m.credit)}</strong><small>Clientes</small></article><article class="metric-card"><span>Por pagar</span><strong>${panelMoney(m.payable)}</strong><small>Proveedores</small></article></section><section class="accounting-tabs" aria-label="Información incluida"><span>Ventas</span><span>Gastos</span><span>Compras</span><span>Proveedores</span><span>Pagos</span><span>Por cobrar</span><span>Por pagar</span></section><section class="panel-business-grid"><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">PROVEEDORES</span><h2>Proveedores</h2></div></div>${suppliers}</article><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">COMPRAS</span><h2>Facturas recientes</h2></div></div>${latestInvoices}</article></section><section class="panel-business-grid"><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">MI CONTADOR</span><h2>${accountant?escapePanelHTML(accountant.name):'Agrega tu contador'}</h2></div></div><p>${accountant?escapePanelHTML(accountant.email||accountant.phone||''):'Guarda el contacto que recibe la información de tu negocio.'}</p><button class="account-secondary-button" onclick="showAccountantForm()">${accountant?'Editar contador':'Agregar contador'}</button></article><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">EXPORTAR</span><h2>Paquete para contador</h2></div></div><p>Descarga un CSV con ventas, gastos, compras, pagos y movimientos de crédito de los últimos 30 días disponibles.</p><button class="business-save-button" onclick="prepareAccountantPackage()">Descargar CSV</button><div id="accountingMessage" class="business-save-message" hidden></div></article></section><div id="accountantFormMount"></div>`);
}

function showAccountantForm(){
  const m=document.querySelector('#accountantFormMount');if(!m)return;const a=window.__panelAccountingData?.accountant||{};
  m.innerHTML=`<section class="business-settings-card finance-form"><div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">👤</div><div><h2>Mi contador</h2><p>Contacto de referencia.</p></div></div><div class="business-form-grid"><div class="business-field"><label>Nombre</label><input id="accName" value="${escapePanelHTML(a.name||'')}"></div><div class="business-field"><label>Correo</label><input id="accEmail" type="email" value="${escapePanelHTML(a.email||'')}"></div><div class="business-field"><label>Teléfono / WhatsApp</label><input id="accPhone" value="${escapePanelHTML(a.phone||'')}"></div></div><div class="business-settings-actions"><button id="saveAccountantButton" class="business-save-button" onclick="saveAccountant()">Guardar contador</button></div><div id="accMessage" class="business-save-message" hidden></div></div></section>`;
}

async function saveAccountant(){
  const row={business_id:panelBusiness.id,name:document.querySelector('#accName')?.value.trim(),email:document.querySelector('#accEmail')?.value.trim().toLowerCase()||null,phone:document.querySelector('#accPhone')?.value.trim()||null},box=document.querySelector('#accMessage'),button=document.querySelector('#saveAccountantButton');if(!row.name){if(box){box.hidden=false;box.className='business-save-message error';box.textContent='Escribe el nombre del contador.';}return;}
  try{if(button){button.disabled=true;button.textContent='Guardando…';}const {error}=await panelCloud.from('business_accountants').upsert(row,{onConflict:'business_id'});if(error)throw error;clearEntrepreneurSnapshotCache();await renderAccountingSection();}
  catch(error){if(box){box.hidden=false;box.className='business-save-message error';box.textContent=error?.message||'No se pudo guardar el contador.';}}
  finally{if(button){button.disabled=false;button.textContent='Guardar contador';}}
}

function csvCell(value){const s=String(value??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
function downloadPanelFile(name,content,type='text/csv;charset=utf-8'){const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function prepareAccountantPackage(){
  const d=window.__panelAccountingData,m=window.__panelAccountingMetrics,box=document.querySelector('#accountingMessage');if(!d||!m||!panelBusiness)return;
  const now=new Date(),from=new Date();from.setDate(from.getDate()-29);from.setHours(0,0,0,0);const in30=v=>{const x=new Date(String(v).length===10?`${v}T12:00:00`:v);return x>=from&&x<=now;};
  const suppliers=new Map((d.suppliers||[]).map(r=>[r.id,r.name||'Proveedor']));
  const rows=[['tipo','fecha','referencia','descripcion','monto_crc','estado']];
  rows.push(['RESUMEN',now.toISOString().slice(0,10),'ventas_30_dias','Ventas últimos 30 días',m.monthRevenue,'']);
  rows.push(['RESUMEN',now.toISOString().slice(0,10),'gastos_30_dias','Gastos últimos 30 días',m.expenseTotal,'']);
  rows.push(['RESUMEN',now.toISOString().slice(0,10),'por_cobrar','Crédito pendiente',m.credit,'']);
  rows.push(['RESUMEN',now.toISOString().slice(0,10),'por_pagar','Proveedores pendientes',m.payable,'']);
  for(const r of panelActiveSales(d.sales||[]).filter(r=>in30(r.created_at)))rows.push(['VENTA',r.created_at,r.id,r.payment_method||'Venta',Number(r.total||0),r.status||'']);
  for(const r of (d.expenses||[]).filter(r=>!r.voided&&in30(r.expense_date||r.created_at)))rows.push(['GASTO',r.expense_date||r.created_at,'',r.description||r.category||'Gasto',Number(r.total||0),r.condition||'']);
  for(const r of (d.supplierInvoices||[]).filter(r=>!r.voided&&in30(r.invoice_date||r.created_at)))rows.push(['FACTURA_PROVEEDOR',r.invoice_date||r.created_at,r.document_number||'',suppliers.get(r.supplier_id)||'Proveedor',Number(r.total||0),`saldo ${panelInvoiceBalance(r,d.supplierPayments||[])}`]);
  for(const r of (d.supplierPayments||[]).filter(r=>in30(r.payment_date||r.created_at)))rows.push(['PAGO_PROVEEDOR',r.payment_date||r.created_at,r.reference||'',suppliers.get((d.supplierInvoices||[]).find(i=>i.id===r.invoice_id)?.supplier_id)||'Proveedor',Number(r.amount||0),r.method||'']);
  for(const r of (d.creditMoves||[]).filter(r=>in30(r.created_at)))rows.push(['CREDITO_CLIENTE',r.created_at,'',r.movement_type||'Movimiento crédito',Number(r.amount||0),'']);
  const csv=rows.map(row=>row.map(csvCell).join(',')).join('\n');const safeName=String(panelBusiness.name||'negocio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();downloadPanelFile(`punto-ya-cr-contador-${safeName||'negocio'}-${now.toISOString().slice(0,10)}.csv`,csv);
  if(box){box.hidden=false;box.className='business-save-message success';box.textContent='CSV preparado y descargado. Revísalo antes de enviarlo a tu contador.';}
}

window.renderMoneySection=renderMoneySection;window.renderGrowthSection=renderGrowthSection;window.renderAccountingSection=renderAccountingSection;window.showExpenseForm=showExpenseForm;window.saveExpense=saveExpense;window.showSupplierForm=showSupplierForm;window.saveSupplier=saveSupplier;window.showSupplierInvoiceForm=showSupplierInvoiceForm;window.saveSupplierInvoice=saveSupplierInvoice;window.showSupplierPaymentForm=showSupplierPaymentForm;window.saveSupplierPayment=saveSupplierPayment;window.saveGrowthGoal=saveGrowthGoal;window.runGrowthSimulation=runGrowthSimulation;window.showAccountantForm=showAccountantForm;window.saveAccountant=saveAccountant;window.prepareAccountantPackage=prepareAccountantPackage;

/* SUPER ADMIN: el acceso real se valida en Supabase mediante RPC. */
async function checkPlatformAdminAccess(){
  const mount=document.getElementById("platformAdminAccess");
  if(!mount||!panelCloud||!panelUser)return;
  try{
    const {data,error}=await panelCloud.rpc("is_platform_admin");
    if(error||data!==true){mount.innerHTML="";return;}
    mount.innerHTML=`<section class="platform-admin-entry"><div><span class="dashboard-eyebrow">SUPER ADMIN · PRIVADO</span><h2>Administración PUNTO YA CR</h2><p>Negocios, suscripciones, códigos PRO, Programa Fundadores y newsletter.</p></div><a href="admin.html">Abrir administración →</a></section>`;
  }catch(_){mount.innerHTML="";}
}
window.checkPlatformAdminAccess=checkPlatformAdminAccess;
