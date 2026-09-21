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
  renderPanelDashboard();
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

        document.body.classList.remove(
          "panel-authenticated"
        );

        document.body.classList.add(
          "panel-guest"
        );

        return;
      }


      if (
  panelUser &&
  (
    event === "SIGNED_IN" ||
    event === "INITIAL_SESSION" ||
    event === "TOKEN_REFRESHED" ||
    event === "USER_UPDATED"
  )
) {

  await loadPanelBusiness(panelUser);

  if (panelBusiness) {
    renderPanelDashboard();
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

    await checkPanelSession();

  }
);
/* =========================================================
   LOGIN DEL PANEL DEL EMPRENDEDOR
   ========================================================= */

function openPanelLogin() {

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

renderPanelDashboard();


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

async function loadEntrepreneurSnapshot() {
  const empty = { planTier:"free", sales:[], saleItems:[], products:[], clients:[], payments:[], creditMoves:[], orders:[] };
  if (!panelCloud || !panelBusiness?.id) return empty;
  const businessId = panelBusiness.id;
  const safe = async promise => { try { const r = await promise; return r?.error ? [] : (r?.data || []); } catch (_) { return []; } };
  const [planRows, sales, saleItems, products, clients, payments, creditMoves, orders] = await Promise.all([
    safe(panelCloud.from("business_plans").select("plan_tier,plan_source,plan_period,starts_at,expires_at").eq("business_id", businessId).limit(1)),
    safe(panelCloud.from("sales").select("id,total,status,payment_method,created_at,client_id").eq("business_id", businessId).order("created_at", {ascending:false}).limit(2500)),
    safe(panelCloud.from("sale_items").select("sale_id,product_id,product_name,quantity,unit_price,subtotal,created_at").eq("business_id", businessId).order("created_at", {ascending:false}).limit(5000)),
    safe(panelCloud.from("products").select("id,name,price,cost,stock,active,business_type").eq("business_id", businessId).eq("active", true).limit(2000)),
    safe(panelCloud.from("clients").select("id,name,active,created_at").eq("business_id", businessId).eq("active", true).limit(2000)),
    safe(panelCloud.from("payments").select("sale_id,method,amount,created_at").eq("business_id", businessId).order("created_at", {ascending:false}).limit(3000)),
    safe(panelCloud.from("credit_movements").select("movement_type,amount,created_at,client_id").eq("business_id", businessId).order("created_at", {ascending:false}).limit(3000)),
    safe(panelCloud.from("orders").select("id,status,total,created_at").eq("business_id", businessId).order("created_at", {ascending:false}).limit(1500))
  ]);
  return { planTier:String(planRows[0]?.plan_tier || panelBusiness.plan_tier || panelBusiness.plan || "free").toLowerCase(), sales, saleItems, products, clients, payments, creditMoves, orders };
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
  return {todayRevenue,todayCount:todaySales.length,ticket,weekRevenue,weekPct,monthRevenue,monthPct,monthCount:month.length,topProducts,payMap,lowStock,credit,estimatedCost,estimatedMargin,bestDay,clientCount:data.clients.length,productCount:data.products.length,orderCount:data.orders.filter(o=>!["delivered","entregado","cancelled","canceled"].includes(String(o.status||"").toLowerCase())).length};
}

async function renderPanelDashboard() {
  if (!panelUser || !panelBusiness) return;
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
   <header class="dashboard-header"><div class="dashboard-header-inner"><a href="index.html" class="dashboard-brand"><img src="assets/logo-horizontal.png" alt="PUNTO YA CR"></a><nav class="panel-topnav"><a href="#resumen">Resumen</a><a href="#ventas">Ventas</a><a href="#dinero">Dinero</a><a href="#crecimiento">Crecimiento</a></nav><div class="dashboard-account"><div class="dashboard-business-mini"><strong>${escapePanelHTML(businessName)}</strong><span>${planLabel}</span></div><button class="dashboard-logout" onclick="panelLogout()">Cerrar sesión</button></div></div></header>
   <main class="dashboard-main entrepreneur-main">
    <section id="resumen" class="business-overview-head"><div><span class="dashboard-eyebrow">ASÍ VA TU NEGOCIO</span><h1>${escapePanelHTML(businessName)}</h1><p>${escapePanelHTML(typeLabel)} · Datos sincronizados desde PUNTO YA CR.</p></div><span class="plan-pill ${isPro?"pro":"free"}">${isPro?"PRO":"FREE"}</span></section>
    <section class="metric-grid"><article class="metric-card hero"><span>Ventas de hoy</span><strong>${panelMoney(m.todayRevenue)}</strong><small>${m.todayCount} venta${m.todayCount===1?"":"s"}</small></article><article class="metric-card"><span>Ticket promedio</span><strong>${panelMoney(m.ticket)}</strong><small>Hoy</small></article><article class="metric-card"><span>Esta semana</span><strong>${panelMoney(m.weekRevenue)}</strong><small>${m.weekRevenue?panelTrendText(m.weekPct):"Sin comparación todavía"}</small></article><article class="metric-card"><span>Últimos 30 días</span><strong>${panelMoney(m.monthRevenue)}</strong><small>${m.monthCount} ventas</small></article></section>
    <section class="business-story"><div><span class="dashboard-eyebrow">EN PALABRAS SIMPLES</span><h2>${isPro?"Lo que está pasando en tu negocio":"Una mirada rápida a tu negocio"}</h2></div><div class="story-cards"><article><strong>${insight1}</strong><span>${isPro?insight2:"Con Pro también puedes descubrir tendencias, comparaciones y oportunidades."}</span></article><article><strong>${alerts[0]}</strong><span>${alerts.slice(1).join(" ")||"Revisa esta información cuando lo necesites."}</span></article></div></section>
    <section id="ventas" class="panel-business-grid"><article class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">VENTAS</span><h2>Lo que más vendes</h2></div><span>30 días</span></div>${topHtml}</article><article id="dinero" class="business-data-card"><div class="data-card-head"><div><span class="dashboard-eyebrow">DINERO</span><h2>Cómo te pagaron</h2></div><span>30 días</span></div>${paymentHtml}<div class="money-total"><span>Crédito pendiente</span><strong>${panelMoney(m.credit)}</strong></div></article></section>
    ${isPro?`<section class="pro-zone"><div class="pro-zone-title"><span class="dashboard-eyebrow">PUNTO YA CR PRO</span><h2>Entiende y haz crecer tu negocio</h2><p>No solo veas números. Descubre qué significan.</p></div><div class="pro-metric-grid"><article><span>Ventas 30 días</span><strong>${panelMoney(m.monthRevenue)}</strong><small>${panelTrendText(m.monthPct)}</small></article><article><span>Costo estimado de productos</span><strong>${panelMoney(m.estimatedCost)}</strong><small>Según costos registrados en productos</small></article><article><span>Margen antes de gastos</span><strong>${panelMoney(m.estimatedMargin)}</strong><small>Ventas menos costo estimado</small></article><article><span>Clientes</span><strong>${m.clientCount}</strong><small>Registrados</small></article></div><div id="crecimiento" class="growth-grid"><article class="growth-card"><span class="growth-icon">↗</span><h3>Oportunidades</h3><p>${insight2}</p></article><article class="growth-card"><span class="growth-icon">◎</span><h3>Salud del negocio</h3><p>${alerts.join(" ")}</p></article><article class="growth-card"><span class="growth-icon">🎯</span><h3>Metas inteligentes</h3><p>Compara tu avance semanal y mensual con tu propio historial.</p><div class="goal-progress"><i style="width:${Math.max(8,Math.min(100,50+m.weekPct))}%"></i></div></article><article class="growth-card"><span class="growth-icon">◫</span><h3>Inventario</h3><p>${m.lowStock.length?`${m.lowStock.length} productos necesitan atención.`:`${m.productCount} productos activos y sin alertas de stock bajo.`}</p></article></div><section class="ask-punto"><div><span class="dashboard-eyebrow">PREGÚNTALE A PUNTO YA</span><h2>Pregunta por tu negocio</h2><p>Respuestas rápidas basadas en los datos que ya tienes.</p></div><div class="ask-chips"><button onclick="askPuntoYa('ventas')">¿Cómo van mis ventas?</button><button onclick="askPuntoYa('producto')">¿Qué vendo más?</button><button onclick="askPuntoYa('alertas')">¿Qué debo revisar?</button><button onclick="askPuntoYa('crecimiento')">¿Estoy creciendo?</button></div><div id="puntoAnswer" class="punto-answer">Elige una pregunta.</div></section>`:`<section id="crecimiento" class="free-pro-preview"><div><span class="dashboard-eyebrow">HAZ CRECER TU NEGOCIO</span><h2>Hay más detrás de tus ventas.</h2><p>Con Pro puedes ver comparaciones, tendencias, margen estimado, oportunidades, salud del negocio y Pregúntale a PUNTO YA.</p></div><button onclick="openDashboardSection('plan')">Conocer Pro →</button><div class="preview-grid"><span>Comparaciones</span><span>Oportunidades</span><span>Metas</span><span>Salud del negocio</span><span>Dinero y margen</span><span>Pregúntale a PUNTO YA</span></div></section>`}
    <section class="panel-alert-section"><div class="data-card-head"><div><span class="dashboard-eyebrow">ATENCIÓN</span><h2>Lo que conviene revisar</h2></div></div><div class="alert-list">${alerts.map(a=>`<div><span>!</span><p>${escapePanelHTML(a)}</p></div>`).join("")}</div></section>
    <section class="dashboard-tools admin-zone"><div class="dashboard-section-title"><div><span class="dashboard-eyebrow">ADMINISTRACIÓN</span><h2>Tu cuenta y tu negocio</h2></div></div><div class="dashboard-tool-grid">${[["business","🏪","Mi negocio","Información, contacto y ubicación."],["account","👤","Mi cuenta","Perfil y seguridad."],["devices","▣","Dispositivos","Accesos y sincronización."],["billing","₡","Facturación","Configuración fiscal."],["plan","✦",planLabel,"Estado de tu plan."],["support","?","Soporte","Ayuda de PUNTO YA CR."]].map(([id,ic,t,d])=>`<button class="dashboard-tool" onclick="openDashboardSection('${id}')"><span class="dashboard-tool-icon">${ic}</span><span><strong>${escapePanelHTML(t)}</strong><small>${escapePanelHTML(d)}</small></span><b>→</b></button>`).join("")}</div></section>
    <section class="pos-return"><div><span class="dashboard-eyebrow">PUNTO DE VENTA</span><h2>¿Listo para trabajar?</h2><p>Vuelve a ventas, caja, pedidos y operación diaria.</p></div><a href="${PUNTO_YA_APP}">Abrir PUNTO YA CR →</a></section>
   </main><footer class="dashboard-footer"><img src="assets/logo-horizontal.png" alt="PUNTO YA CR"><p>© 2026 PUNTO YA CR · Tu negocio, más simple.</p></footer>
  </div>`;
  window.__panelMetrics=m; window.__panelIsPro=isPro;
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
      address
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
                Propietario
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
  const tier = String(plan?.plan_tier || panelBusiness.plan || "free").toLowerCase();
  const isPro = tier === "pro";
  const expires = plan?.expires_at ? new Date(plan.expires_at).toLocaleDateString("es-CR", { dateStyle: "medium" }) : "Sin fecha definida";
  panelSectionShell(
    "PLAN ACTUAL",
    isPro ? "PUNTO YA CR Pro" : "PUNTO YA CR Free",
    "Consulta el estado de tu plan y las funciones asociadas a tu negocio.",
    `<section class="business-settings-card">
      <div class="business-settings-block">
        <div class="business-settings-title"><div class="business-settings-icon">✦</div><div><h2>${isPro ? "Plan Pro" : "Plan Free"}</h2><p>${isPro ? "Tu negocio tiene acceso a las funciones Pro habilitadas." : "Tu negocio está utilizando el plan gratuito."}</p></div></div>
        <div class="account-status-card"><div><span class="account-status-dot"></span><strong>${isPro ? "Pro activo" : "Free activo"}</strong></div><span class="account-owner-badge">${isPro ? "PRO" : "FREE"}</span></div>
        ${isPro ? `<p class="panel-plan-date">Vigencia: ${escapePanelHTML(expires)}</p>` : ""}
      </div>
      <div class="business-settings-block"><div class="business-settings-title"><div class="business-settings-icon">✓</div><div><h2>Tu plan, claro</h2><p>El Panel muestra el plan registrado para este negocio. No se realizan cobros desde esta pantalla.</p></div></div><div class="panel-info-card"><strong>Tu negocio, más simple.</strong><p>Puedes seguir usando el punto de venta y consultar aquí el estado de tu cuenta.</p></div></div>
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
