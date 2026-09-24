import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

const TILOPAY_BASE = "https://app.tilopay.com";
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
async function getTilopayToken(): Promise<string> {
  const apiuser=Deno.env.get("TILOPAY_APIUSER"), password=Deno.env.get("TILOPAY_PASSWORD");
  if(!apiuser||!password) throw new Error("Credenciales API de Tilopay incompletas.");
  const res=await fetch(`${TILOPAY_BASE}/api/v1/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiuser,password})});
  const body=await res.json(); if(!res.ok||!body?.access_token) throw new Error("No fue posible autenticar con Tilopay."); return String(body.access_token);
}
async function consultTilopayTransaction(orderNumber:string){
  const key=Deno.env.get("TILOPAY_KEY"); if(!key) throw new Error("TILOPAY_KEY no está configurado.");
  const token=await getTilopayToken();
  const res=await fetch(`${TILOPAY_BASE}/api/v1/consult`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`bearer ${token}`},body:JSON.stringify({key,orderNumber,merchantId:""})});
  const body=await res.json(); if(!res.ok) throw new Error("No fue posible consultar la transacción en Tilopay.");
  const rows=Array.isArray(body?.response)?body.response:[]; const tx=rows.find((x:Record<string,unknown>)=>String(x?.orderNumber??"")===orderNumber)??rows[0];
  if(!tx) throw new Error("Tilopay no devolvió la transacción."); return {raw:body,transaction:tx};
}
async function codeFor(orderNumber:string){
  const secret=Deno.env.get("TILOPAY_CODE_SECRET"); if(!secret||secret.length<32) throw new Error("TILOPAY_CODE_SECRET no está configurado.");
  const enc=new TextEncoder(), key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,enc.encode(`PUNTO-YA-CR:TILOPAY:${orderNumber}`));
  const hex=Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase(); return `PYCR-${hex.slice(0,4)}-${hex.slice(4,8)}`;
}
export default { fetch: withSupabase({auth:"none"}, async (req,ctx)=>{
  if(req.method==="GET") return json({ok:true,service:"PUNTO YA CR Tilopay webhook"});
  if(req.method!=="POST") return json({ok:false,message:"Método no permitido."},405);
  try{
    if((new URL(req.url)).searchParams.get("event")!=="payment") return json({ok:true,ignored:true,reason:"Evento todavía no habilitado."});
    let payload:Record<string,unknown>; try{payload=await req.json();}catch{return json({ok:true,ignored:true,reason:"JSON inválido."});}
    const planId=Number(payload.id_plan??0), email=String(payload.email??"").trim().toLowerCase(), orderNumber=String(payload.orderNumber??"").trim(), webhookAmount=Number(payload.amount??0), webhookAuth=String(payload.auth??"").trim();
    if(!new Set([7410,7411,7412]).has(planId)) return json({ok:true,ignored:true,reason:"Plan Tilopay no reconocido."});
    if(!email||!orderNumber) return json({ok:true,ignored:true,reason:"Datos obligatorios incompletos."});
    const verified=await consultTilopayTransaction(orderNumber), tx=verified.transaction as Record<string,unknown>;
    const verifiedOrder=String(tx.orderNumber??"").trim(), verifiedAmount=Number(tx.amount??0), verifiedCurrency=String(tx.currency??"").trim().toUpperCase(), verifiedAuth=String(tx.auth??"").trim(), verifiedCode=String(tx.code??"").trim(), environment=String(tx.environment??"").trim();
    if(verifiedOrder!==orderNumber) return json({ok:true,verified:false,reason:"orderNumber no coincide."});
    if(verifiedCode!=="1") return json({ok:true,verified:false,reason:"La transacción no está aprobada."});
    if(Number.isFinite(webhookAmount)&&webhookAmount>0&&Math.abs(verifiedAmount-webhookAmount)>0.01) return json({ok:true,verified:false,reason:"El monto no coincide."});
    if(webhookAuth&&verifiedAuth&&webhookAuth!==verifiedAuth) return json({ok:true,verified:false,reason:"La autorización no coincide."});
    const {data,error}=await ctx.supabaseAdmin.rpc("tilopay_register_verified_payment",{p_order_number:orderNumber,p_plan_id:planId,p_email:email,p_amount:verifiedAmount,p_currency:verifiedCurrency,p_activation_code:await codeFor(orderNumber),p_auth_code:verifiedAuth,p_environment:environment,p_raw_payload:payload,p_verified_payload:verified.raw});
    if(error){console.error(error);return json({ok:false,message:"No fue posible registrar el pago."},502);}
    return json({ok:true,verified:true,processed:true,action:data?.action??null});
  }catch(error){console.error(error);return json({ok:false,message:error instanceof Error?error.message:"Error interno."},502);}
})};
