const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');
const MAX = 25 * 1024 * 1024;
const errors = [];

const wrangler = JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
if (wrangler?.assets?.directory !== './public') errors.push('wrangler.jsonc debe publicar únicamente ./public');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(ent => {
    const p = path.join(dir, ent.name);
    return ent.isDirectory() ? walk(p) : [p];
  });
}

for (const required of ['index.html','panel.html','admin.html','pago-pro.html','app.js','panel.js','admin.js','styles.css','panel.css','admin.css']) {
  if (!fs.existsSync(path.join(pub, required))) errors.push(`Falta public/${required}`);
}

const files = walk(pub);
for (const f of files) {
  const size = fs.statSync(f).size;
  if (size > MAX) errors.push(`Asset >25 MiB: ${path.relative(pub,f)} (${size})`);
  if (f.includes(`${path.sep}node_modules${path.sep}`)) errors.push(`node_modules dentro de public: ${f}`);
}

const htmlFiles = files.filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/href=["']#["']/i.test(text)) errors.push(`href="#" en ${path.relative(pub,file)}`);
  if (/Mi Punto CR/i.test(text)) errors.push(`Marca antigua en ${path.relative(pub,file)}`);

  const refs = [...text.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = clean.startsWith('/')
      ? path.resolve(pub, clean.replace(/^\/+/, ''))
      : path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) errors.push(`Referencia local faltante en ${path.relative(pub,file)} -> ${ref}`);
  }
}

const index = fs.readFileSync(path.join(pub,'index.html'),'utf8');
if (!index.includes('https://puntoyacr.com/')) errors.push('Falta canonical/dominio puntoyacr.com en index.html');
if (!/Precios finales\. Impuestos incluidos\./i.test(index)) errors.push('Falta texto de impuestos incluidos');
if (!/EN PREPARACIÓN/i.test(index)) errors.push('Facturación electrónica no está marcada EN PREPARACIÓN');
if (!/Android[\s\S]{0,300}PRÓXIMAMENTE/i.test(index)) errors.push('Android no está marcado PRÓXIMAMENTE');
if (/Descargar para Android/i.test(index)) errors.push('Android todavía muestra una descarga no disponible');
if (!/https:\/\/tp\.cr\/l\/TnpReE1nPT18MQ==/.test(index) || !/TnpReE1RPT18MQ==/.test(index) || !/TnpReE1BPT18MQ==/.test(index)) errors.push('Faltan uno o más enlaces reales de Tilopay en los planes PRO');
if (/pagos en línea estarán disponibles|cuando conectemos la pasarela/i.test(index)) errors.push('La principal conserva texto de pasarela pendiente');
if (!/eliminar-cuenta\.html\?type=marketing_optout/i.test(index)) errors.push('Newsletter no muestra una vía visible para dejar comunicaciones');

const admin = fs.readFileSync(path.join(pub,'admin.html'),'utf8');
if (!/name=["']robots["'][^>]+noindex/i.test(admin)) errors.push('admin.html debe tener noindex');
const panel = fs.readFileSync(path.join(pub,'panel.html'),'utf8');
if (!/name=["']robots["'][^>]+noindex/i.test(panel)) errors.push('panel.html debe tener noindex');
const appJs = fs.readFileSync(path.join(pub,'app.js'),'utf8');
if (/newsletter_subscribers[\s\S]{0,120}insert\s*\(/i.test(appJs)) errors.push('Newsletter conserva un fallback de inserción directa');
const panelJs = fs.readFileSync(path.join(pub,'panel.js'),'utf8');
if (!/tilopay-my-code/.test(panelJs)) errors.push('El Panel no consulta la compra web de Tilopay');
if (/No se pudo comprobar la aceptación legal:[\s\S]{0,120}return true/i.test(panelJs)) errors.push('El control legal del Panel todavía falla abierto');
if (!/if \(!\(await ensurePanelLegalAcceptance\(\)\)\) return/.test(panelJs)) errors.push('El Panel no bloquea la entrada cuando falla el control legal');

for (const legalName of ['centro-legal.html','privacidad.html','terminos.html']) {
  const legal = fs.readFileSync(path.join(pub,legalName),'utf8');
  if (/Ministerio de Hacienda|actividad de programación informática|Domicilio fiscal/i.test(legal)) errors.push(`Información fiscal innecesaria visible en ${legalName}`);
}

const visibleText = index.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ');
if (/\bbeta\b|antes del lanzamiento|pre[- ]?lanzamiento|borrador/i.test(visibleText)) errors.push('La principal contiene texto visible de beta/borrador/pre-lanzamiento');

function walkProject(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(ent => {
    if (ent.name === 'node_modules' || ent.name === '.git') return [];
    const p = path.join(dir, ent.name);
    return ent.isDirectory() ? walkProject(p) : [p];
  });
}
const projectFiles = walkProject(root);
for (const f of projectFiles) { if (f.toLowerCase().endsWith('.sql')) errors.push(`No se permiten archivos SQL dentro del ZIP: ${path.relative(root,f)}`); }

if (errors.length) {
  console.error('VERIFICACIÓN ESTÁTICA FALLÓ:');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}

console.log(`OK: ${files.length} archivos públicos verificados; ninguno supera 25 MiB.`);
