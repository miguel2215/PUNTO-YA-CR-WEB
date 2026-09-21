const PUBLIC_SUPABASE_URL="https://uspycwpztzkenwsevvrp.supabase.co";
const PUBLIC_SUPABASE_KEY="sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy";
let publicCloud=null;
function getPublicCloud(){if(publicCloud)return publicCloud;if(!window.supabase?.createClient)return null;publicCloud=window.supabase.createClient(PUBLIC_SUPABASE_URL,PUBLIC_SUPABASE_KEY);return publicCloud;}

document.querySelectorAll('.pending-payment').forEach(btn=>btn.addEventListener('click',()=>{const cycle=btn.dataset.cycle||'Pro';alert('El pago '+cycle+' estará disponible cuando conectemos la pasarela oficial. Si tienes un código PRO, puedes activarlo desde tu Panel del Emprendedor.');}));

const tabletBtn=[...document.querySelectorAll('button')].find(b=>/Usar en Tablet/i.test(b.textContent));
if(tabletBtn)tabletBtn.addEventListener('click',()=>window.open('https://mipuntocr.mieduar2215.workers.dev/','_blank','noopener'));
const androidBtn=[...document.querySelectorAll('button')].find(b=>/Descargar para Android/i.test(b.textContent));
if(androidBtn)androidBtn.addEventListener('click',()=>alert('La versión Android estará disponible cuando publiquemos el APK/Google Play oficial.'));

const nf=document.getElementById('newsletterForm');
if(nf)nf.addEventListener('submit',async e=>{e.preventDefault();const email=document.getElementById('newsletterEmail')?.value.trim();const msg=document.getElementById('newsletterMessage');if(!email)return;const c=getPublicCloud();if(!c){msg.textContent='No se pudo conectar. Intenta nuevamente.';return;}msg.textContent='Guardando…';const {error}=await c.from('newsletter_subscribers').insert({email,source:'website'});if(error&&error.code!=='23505'){msg.textContent='No pudimos guardar tu correo. Intenta nuevamente.';return;}msg.textContent='¡Listo! Te avisaremos de las novedades de PUNTO YA CR.';nf.reset();});
