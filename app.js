const PUBLIC_SUPABASE_URL="https://uspycwpztzkenwsevvrp.supabase.co";
const PUBLIC_SUPABASE_KEY="sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy";
const PUBLIC_APP_URL="https://mipuntocr.mieduar2215.workers.dev/";
let publicCloud=null;
function getPublicCloud(){if(publicCloud)return publicCloud;if(!window.supabase?.createClient)return null;publicCloud=window.supabase.createClient(PUBLIC_SUPABASE_URL,PUBLIC_SUPABASE_KEY);return publicCloud;}

function showPublicNotice(message){
  let box=document.getElementById('publicNotice');
  if(!box){box=document.createElement('div');box.id='publicNotice';box.className='public-notice';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box);}
  box.textContent=message;box.classList.add('show');clearTimeout(showPublicNotice._t);showPublicNotice._t=setTimeout(()=>box.classList.remove('show'),4500);
}

document.querySelectorAll('.pending-payment').forEach(btn=>btn.addEventListener('click',()=>{
  const labels={monthly:'mensual',quarterly:'trimestral',annual:'anual'};
  showPublicNotice(`El pago ${labels[btn.dataset.cycle]||'PRO'} estará disponible cuando conectemos la pasarela oficial. Si ya tienes un código PRO, puedes activarlo desde tu Panel del Emprendedor.`);
}));

const tabletBtn=[...document.querySelectorAll('button')].find(b=>/Usar en Tablet/i.test(b.textContent));
if(tabletBtn)tabletBtn.addEventListener('click',()=>window.open(PUBLIC_APP_URL,'_blank','noopener'));
const androidBtn=[...document.querySelectorAll('button')].find(b=>/Descargar para Android/i.test(b.textContent));
if(androidBtn)androidBtn.addEventListener('click',()=>showPublicNotice('La versión Android estará disponible cuando publiquemos el APK / Google Play oficial.'));

const nf=document.getElementById('newsletterForm');
if(nf)nf.addEventListener('submit',async e=>{
  e.preventDefault();
  const field=document.getElementById('newsletterEmail'),msg=document.getElementById('newsletterMessage');
  const email=field?.value.trim().toLowerCase();
  if(!email){msg.textContent='Escribe un correo válido.';return;}
  const c=getPublicCloud();if(!c){msg.textContent='No se pudo conectar. Intenta nuevamente.';return;}
  const button=nf.querySelector('button[type="submit"]');if(button){button.disabled=true;button.textContent='Guardando…';}
  msg.textContent='Guardando…';
  try{
    const {error}=await c.from('newsletter_subscribers').insert({email,source:'website'});
    if(error&&error.code!=='23505')throw error;
    msg.textContent=error?.code==='23505'?'Ese correo ya está registrado.':'¡Listo! Te avisaremos de las novedades de PUNTO YA CR.';
    nf.reset();
  }catch(_){msg.textContent='No pudimos guardar tu correo. Intenta nuevamente.';}
  finally{if(button){button.disabled=false;button.textContent='Suscribirse';}}
});
