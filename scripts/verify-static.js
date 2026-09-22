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

for (const required of ['index.html','panel.html','admin.html','app.js','panel.js','admin.js','styles.css','panel.css','admin.css']) {
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
    const target = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) errors.push(`Referencia local faltante en ${path.relative(pub,file)} -> ${ref}`);
  }
}

const index = fs.readFileSync(path.join(pub,'index.html'),'utf8');
if (!index.includes('https://puntoyacr.com/')) errors.push('Falta canonical/dominio puntoyacr.com en index.html');
if (!/Precios finales\. Impuestos incluidos\./i.test(index)) errors.push('Falta texto de impuestos incluidos');
if (!/EN PREPARACIÓN/i.test(index)) errors.push('Facturación electrónica no está marcada EN PREPARACIÓN');

if (errors.length) {
  console.error('VERIFICACIÓN ESTÁTICA FALLÓ:');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}

console.log(`OK: ${files.length} archivos públicos verificados; ninguno supera 25 MiB.`);
