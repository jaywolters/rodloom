import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
const files=['index.html','theme.js','standard-designs.js','app.js','catalog.js','geometry.js','style.css','favicon.svg','robots.txt','sitemap.xml'];
const endpoint=process.env.RODLOOM_API_BASE||'';
if(endpoint && !/^https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com$/.test(endpoint)) throw Error('Invalid catalog API endpoint');
mkdirSync('dist',{recursive:true});
for(const file of files) copyFileSync(file,`dist/${file}`);
writeFileSync('dist/config.js',`window.RODLOOM_API_BASE = ${JSON.stringify(endpoint)};\n`);
