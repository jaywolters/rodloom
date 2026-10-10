import { mkdirSync, copyFileSync, writeFileSync, cpSync, readFileSync, existsSync } from 'node:fs';
const files=['index.html','theme.js','standard-designs.js','app.js','band-menu.js','layout.js','colors.js','catalog.js','geometry.js','style.css','favicon.svg','robots.txt','sitemap.xml'];
const endpoint=process.env.RODLOOM_API_BASE||'';
if(endpoint && !/^https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com$/.test(endpoint)) throw Error('Invalid catalog API endpoint');
const catalog=JSON.parse(readFileSync('assets/catalog.json','utf8'));
for(const item of catalog.items){
 if(!/^assets\/swatches\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(item.image)||!existsSync(item.image)) throw Error(`Missing bundled swatch: ${item.id}`);
}
mkdirSync('dist',{recursive:true});
cpSync('assets','dist/assets',{recursive:true});
for(const file of files) copyFileSync(file,`dist/${file}`);
writeFileSync('dist/config.js',`window.RODLOOM_API_BASE = ${JSON.stringify(endpoint)};\n`);
