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

function renderPanelDashboard() {

  if (!panelUser || !panelBusiness) return;

  const businessName =
    panelBusiness.name ||
    panelBusiness.business_name ||
    "Mi negocio";

  const ownerName =
    panelBusiness.owner_name ||
    panelUser.user_metadata?.full_name ||
    panelUser.user_metadata?.name ||
    "";

  const businessType =
    panelBusiness.business_type ||
    panelBusiness.type ||
    "";

  const plan =
    panelBusiness.plan_tier ||
    panelBusiness.plan ||
    "free";

  const typeLabel =
    businessType === "food"
      ? "Restaurante"
      : businessType === "products"
        ? "Retail"
        : "Negocio";

  const planLabel =
    String(plan).toLowerCase() === "pro"
      ? "PUNTO YA CR Pro"
      : "PUNTO YA CR Free";


  document.body.innerHTML = `

    <div class="entrepreneur-dashboard">

      <!-- ================================================
           HEADER
           ================================================ -->

      <header class="dashboard-header">

        <div class="dashboard-header-inner">

          <a
            href="index.html"
            class="dashboard-brand">

            <img
              src="assets/logo-horizontal.png"
              alt="PUNTO YA CR">

          </a>


          <div class="dashboard-account">

            <div class="dashboard-business-mini">

              <strong>${escapePanelHTML(businessName)}</strong>

              <span>
                ${escapePanelHTML(planLabel)}
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



      <!-- ================================================
           CONTENIDO
           ================================================ -->

      <main class="dashboard-main">


        <!-- BIENVENIDA -->

        <section class="dashboard-welcome">

          <span class="dashboard-eyebrow">
            PANEL DEL EMPRENDEDOR
          </span>

          <h1>
            ${
              ownerName
                ? `Hola, ${escapePanelHTML(ownerName)}.`
                : "Hola."
            }
          </h1>

          <p>
            Aquí tienes el control de
            <strong>${escapePanelHTML(businessName)}</strong>.
          </p>

        </section>



        <!-- ================================================
             TARJETAS PRINCIPALES
             ================================================ -->

        <section class="dashboard-summary">


          <!-- NEGOCIO -->

          <article class="dashboard-card">

            <div class="dashboard-card-icon">
              🏪
            </div>

            <span class="dashboard-card-label">
              MI NEGOCIO
            </span>

            <h2>
              ${escapePanelHTML(businessName)}
            </h2>

            <p>
              ${escapePanelHTML(typeLabel)}
            </p>

            <button
              type="button"
              class="dashboard-card-link"
              onclick="openDashboardSection('business')">

              Administrar negocio →

            </button>

          </article>



          <!-- PLAN -->

          <article class="dashboard-card">

            <div class="dashboard-card-icon">
              ✦
            </div>

            <span class="dashboard-card-label">
              PLAN ACTUAL
            </span>

            <h2>
              ${escapePanelHTML(planLabel)}
            </h2>

            <p>
              Consulta las funciones disponibles
              para tu negocio.
            </p>

            <button
              type="button"
              class="dashboard-card-link"
              onclick="openDashboardSection('plan')">

              Ver mi plan →

            </button>

          </article>



          <!-- POS -->

          <article class="dashboard-card dashboard-card-pos">

            <div class="dashboard-card-icon">
              PY
            </div>

            <span class="dashboard-card-label">
              PUNTO YA CR
            </span>

            <h2>
              Punto de venta
            </h2>

            <p>
              Entra directamente a tu sistema
              de ventas.
            </p>

            <a
              class="dashboard-open-pos"
              href="${PUNTO_YA_APP}">

              Abrir PUNTO YA CR →

            </a>

          </article>

        </section>



        <!-- ================================================
             HERRAMIENTAS
             ================================================ -->

        <section class="dashboard-tools">

          <div class="dashboard-section-title">

            <div>

              <span class="dashboard-eyebrow">
                ADMINISTRACIÓN
              </span>

              <h2>
                Tu cuenta y tu negocio
              </h2>

            </div>

          </div>


          <div class="dashboard-tool-grid">


            <button
              class="dashboard-tool"
              onclick="openDashboardSection('business')">

              <span class="dashboard-tool-icon">
                🏪
              </span>

              <span>

                <strong>
                  Mi negocio
                </strong>

                <small>
                  Información y configuración
                  de ${escapePanelHTML(businessName)}.
                </small>

              </span>

              <b>→</b>

            </button>



            <button
              class="dashboard-tool"
              onclick="openDashboardSection('account')">

              <span class="dashboard-tool-icon">
                👤
              </span>

              <span>

                <strong>
                  Mi cuenta
                </strong>

                <small>
                  Datos del propietario y seguridad.
                </small>

              </span>

              <b>→</b>

            </button>



            <button
              class="dashboard-tool"
              onclick="openDashboardSection('devices')">

              <span class="dashboard-tool-icon">
                ▣
              </span>

              <span>

                <strong>
                  Dispositivos
                </strong>

                <small>
                  Acceso y sincronización
                  entre tus equipos.
                </small>

              </span>

              <b>→</b>

            </button>



            <button
              class="dashboard-tool"
              onclick="openDashboardSection('billing')">

              <span class="dashboard-tool-icon">
                ₡
              </span>

              <span>

                <strong>
                  Facturación
                </strong>

                <small>
                  Configuración fiscal
                  y funciones disponibles.
                </small>

              </span>

              <b>→</b>

            </button>



            <button
              class="dashboard-tool"
              onclick="openDashboardSection('plan')">

              <span class="dashboard-tool-icon">
                ✦
              </span>

              <span>

                <strong>
                  PUNTO YA CR Pro
                </strong>

                <small>
                  Consulta tu plan y
                  herramientas adicionales.
                </small>

              </span>

              <b>→</b>

            </button>



            <button
              class="dashboard-tool"
              onclick="openDashboardSection('support')">

              <span class="dashboard-tool-icon">
                ?
              </span>

              <span>

                <strong>
                  Soporte
                </strong>

                <small>
                  Ayuda para utilizar
                  PUNTO YA CR.
                </small>

              </span>

              <b>→</b>

            </button>


          </div>

        </section>


      </main>



      <!-- ================================================
           FOOTER
           ================================================ -->

      <footer class="dashboard-footer">

        <img
          src="assets/logo-horizontal.png"
          alt="PUNTO YA CR">

        <p>
          © 2026 PUNTO YA CR · Hecho en Costa Rica.
        </p>

      </footer>


    </div>

  `;
}


/* =========================================================
   SECCIONES DEL DASHBOARD
   ========================================================= */

function openDashboardSection(section) {

  if (section === "business") {
    renderBusinessSection();
    return;
  }
   if (section === "account") {
  renderAccountSection();
  return;
}

  const sections = {
    account: "Mi cuenta",
    devices: "Dispositivos",
    billing: "Facturación",
    plan: "PUNTO YA CR Pro",
    support: "Soporte"
  };

  console.log(
    "Abrir sección:",
    sections[section] || section
  );
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
