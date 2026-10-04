// Catalog names/codes come from the retailer. Photo sampling is visual approximation only.
(() => {
 let items=[], warnings=[], loaded=false;
 const sampled=new Map();
 function thumbnailUrl(item){
  // Only bundled, content-addressed images are allowed. No remote/API fallback.
  return /^assets\/swatches\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(item.image)?item.image:'';
 }
 function approximateColor(image) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,48,48);
  const pixels=ctx.getImageData(0,0,48,48).data, bins=new Map();
  // Ignore white backdrops and emphasize chromatic pixels; quantization reduces lighting noise.
  for(let y=5;y<43;y++)for(let x=5;x<43;x++){
   const n=(y*48+x)*4,r=pixels[n],g=pixels[n+1],b=pixels[n+2];
   if(pixels[n+3]<128||Math.min(r,g,b)>225)continue;
   const chroma=Math.max(r,g,b)-Math.min(r,g,b);
   const key=[r>>5,g>>5,b>>5].join(',');
   const bucket=bins.get(key)||{weight:0,r:0,g:0,b:0,count:0};
   bucket.weight+=1+chroma/32;bucket.r+=r;bucket.g+=g;bucket.b+=b;bucket.count++;bins.set(key,bucket);
  }
  const best=[...bins.values()].sort((a,b)=>b.weight-a.weight)[0];
  return best?'#'+[best.r,best.g,best.b].map(v=>Math.round(v/best.count).toString(16).padStart(2,'0')).join(''): '#eeeeee';
 }
 function updateLines(){
  const selected=$('thread-line').value;
  $('thread-line').replaceChildren(new Option('All thread lines',''));
  [...new Set(items.filter(i=>i.brand===$('thread-brand').value).map(i=>i.line))].forEach(line=>$('thread-line').append(new Option(line,line)));
  if([...$('thread-line').options].some(o=>o.value===selected))$('thread-line').value=selected;
 }
 function renderCatalog(){
  if(!loaded)return;
  const query=$('color-search').value.trim().toLowerCase(),brand=$('thread-brand').value,line=$('thread-line').value;
  const matches=items.filter(i=>i.brand===brand&&(!line||i.line===line)&&`${i.name} ${i.code} ${i.sku} ${i.line} ${i.finish}`.toLowerCase().includes(query));
  const results=$('color-results');results.replaceChildren();results.classList.add('catalog-grid');
  $('catalog-status').textContent=`${matches.length} size D colors · Mud Hole catalog${warnings.length?' · Some lines unavailable or cached':''}`;
  $('catalog-status').title=warnings.join('; ');
  for(const item of matches){
   const card=make('div','catalog-card');
   const button=make('button','catalog-choice');button.title=`Add ${item.brand} ${item.name}, ${item.line}, size D`;
   const image=make('img','catalog-photo');image.alt=`${item.name} thread swatch`;image.loading='lazy';image.decoding='async';image.width=100;image.height=86;
   const chip=make('span','sample-chip');chip.title='Approximate photo-sampled preview color';chip.style.background='#808080';
   if(sampled.has(item.id)){chip.style.background=sampled.get(item.id);button.disabled=false;}
   image.onload=()=>{
    try{const color=sampled.get(item.id)||approximateColor(image);sampled.set(item.id,color);chip.style.background=color;button.disabled=false;}
    catch{button.disabled=false;button.title+=' — photo sampling unavailable; neutral preview placeholder';}
   };
   image.onerror=()=>{
    image.alt='Photo unavailable';image.hidden=true;
    button.title+=' — photo unavailable; neutral preview placeholder';
   };
   const thumbnail=thumbnailUrl(item);
   if(thumbnail)image.src=thumbnail;
   else image.onerror();
   const name=make('strong','',item.name), detail=make('small','',`${item.line} · D`);
   const availability=make('small','stock-note',item.available?'':'Listed out of stock');
   button.append(image,chip,name,detail,availability);
   button.onclick=()=>{
    const color=sampled.get(item.id);
    if(state.bands.length>=100){notify('Maximum 100 bands per design.');return;}
    addBand({name:item.name,color:color||'#808080',turns:item.finish==='metallic'?5:10,finish:item.finish,brand:item.brand,line:item.line,sku:item.sku,code:item.code,catalog:true,source:item.source});
    notify(color?`${item.name} added · preview color is approximate`:`${item.name} added · preview unavailable, shown in neutral gray`);
   };
   const link=make('a','catalog-source','View product');link.href=item.source;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`View ${item.brand} ${item.name} ${item.line} on Mud Hole`);
   card.append(button,link);results.append(card);
  }
  if(!matches.length)results.append(make('p','hint','No matching size D colors. Try a color code, another thread line, or a broader search.'));
 }
 async function load(){
  $('catalog-status').textContent='Loading size D catalog…';$('catalog-retry').hidden=true;
  $('color-results').replaceChildren();
  try{
   const response=await fetch('assets/catalog.json');if(!response.ok)throw Error('Catalog unavailable');
   const data=await response.json();if(!Array.isArray(data.items)||!data.items.length)throw Error('No catalog entries');
   items=data.items;warnings=data.warnings||[];loaded=true;updateLines();renderCatalog();
   if(warnings.length)$('catalog-retry').hidden=false;
  }catch{
   loaded=false;$('catalog-status').textContent='Bundled catalog unavailable. Retry or check that assets/catalog.json was included in the website deployment.';$('catalog-retry').hidden=false;
  }
 }
 $('thread-brand').onchange=()=>{updateLines();renderCatalog();};$('thread-line').onchange=renderCatalog;
 $('color-search').oninput=renderCatalog;$('catalog-retry').onclick=load;
 load();
})();
