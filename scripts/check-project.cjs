const fs=require('fs');
const required=['package.json','index.html','src/main.jsx','src/styles.css','scripts/check-project.cjs','.github/workflows/build-windows.yml'];
let ok=true; for(const f of required){ if(!fs.existsSync(f)){ console.error('MANQUANT:',f); ok=false; } else console.log('OK',f); }
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); if(!pkg.scripts?.build){ console.error('script build manquant'); ok=false; }
if(!ok) process.exit(1); console.log('Structure projet V85 OK');
