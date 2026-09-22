/* PUNTO YA CR · formularios legales · versión 2026.09 */
const LEGAL_SUPABASE_URL="https://uspycwpztzkenwsevvrp.supabase.co";
const LEGAL_SUPABASE_KEY="sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy";
const LEGAL_VERSION="2026.09";
let legalCloud=null;
function getLegalCloud(){if(legalCloud)return legalCloud;if(!window.supabase?.createClient)return null;legalCloud=window.supabase.createClient(LEGAL_SUPABASE_URL,LEGAL_SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});return legalCloud;}
function legalVal(id){return (document.getElementById(id)?.value||"").trim();}
function setLegalMessage(id,message,kind=""){const el=document.getElementById(id);if(!el)return;el.textContent=message;el.className=`legal-form-message ${kind}`;}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function requestCodeFrom(data){return data?.request_code||data?.claim_code||data?.code||data?.id||"";}

async function submitPrivacyRequest(e){
  e.preventDefault();
  if(legalVal('privacyWebsite'))return;
  const name=legalVal('privacyName'),email=legalVal('privacyEmail').toLowerCase(),type=legalVal('privacyType'),business=legalVal('privacyBusiness'),details=legalVal('privacyDetails');
  if(!name||!validEmail(email)||!type||!document.getElementById('privacyConfirm')?.checked){setLegalMessage('privacyRequestMessage','Completa nombre, correo, tipo de solicitud y confirmación.','error');return;}
  const c=getLegalCloud(); if(!c){setLegalMessage('privacyRequestMessage','No pudimos conectar el formulario. Escríbenos al correo oficial indicado en esta página.','error');return;}
  const btn=document.getElementById('privacySubmit'); if(btn){btn.disabled=true;btn.textContent='Enviando…';}
  try{
    const {data,error}=await c.rpc('submit_privacy_request',{p_full_name:name,p_email:email,p_request_type:type,p_business_reference:business||null,p_details:details||null,p_legal_version:LEGAL_VERSION});
    if(error)throw error;
    const code=requestCodeFrom(data);
    setLegalMessage('privacyRequestMessage',`Solicitud recibida${code?` · Referencia ${code}`:''}. Conserva esta referencia para seguimiento.`,'success');
    document.getElementById('privacyRequestForm')?.reset();
  }catch(err){console.error('Solicitud de privacidad:',err);setLegalMessage('privacyRequestMessage','No pudimos registrar la solicitud en este momento. Puedes enviarla al correo oficial indicado en esta página.','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Enviar solicitud';}}
}

async function submitIpClaim(e){
  e.preventDefault();
  if(legalVal('ipWebsite'))return;
  const name=legalVal('ipName'),email=legalVal('ipEmail').toLowerCase(),rightType=legalVal('ipRightType'),rightDescription=legalVal('ipRightDescription'),contentLocation=legalVal('ipContentLocation'),explanation=legalVal('ipExplanation'),evidence=legalVal('ipEvidence');
  if(!name||!validEmail(email)||!rightType||!rightDescription||!contentLocation||!explanation||!document.getElementById('ipGoodFaith')?.checked){setLegalMessage('ipClaimMessage','Completa los campos obligatorios y confirma la declaración de buena fe.','error');return;}
  const c=getLegalCloud(); if(!c){setLegalMessage('ipClaimMessage','No pudimos conectar el formulario. Escríbenos al correo oficial indicado en esta página.','error');return;}
  const btn=document.getElementById('ipSubmit'); if(btn){btn.disabled=true;btn.textContent='Enviando…';}
  try{
    const {data,error}=await c.rpc('submit_ip_claim',{p_full_name:name,p_email:email,p_right_type:rightType,p_right_description:rightDescription,p_content_location:contentLocation,p_explanation:explanation,p_evidence_reference:evidence||null,p_good_faith:true,p_legal_version:LEGAL_VERSION});
    if(error)throw error;
    const code=requestCodeFrom(data);
    setLegalMessage('ipClaimMessage',`Reclamo recibido${code?` · Referencia ${code}`:''}. Conserva esta referencia para seguimiento.`,'success');
    document.getElementById('ipClaimForm')?.reset();
  }catch(err){console.error('Reclamo PI:',err);setLegalMessage('ipClaimMessage','No pudimos registrar el reclamo en este momento. Puedes enviarlo al correo oficial indicado en esta página.','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='Enviar reclamo';}}
}

document.getElementById('privacyRequestForm')?.addEventListener('submit',submitPrivacyRequest);
document.getElementById('ipClaimForm')?.addEventListener('submit',submitIpClaim);
