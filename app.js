'use strict';
const $ = id => document.getElementById(id);
const isCatalogThread = b => b && b.catalog===true && ['Fuji','ProWrap'].includes(b.brand) && typeof b.sku==='string' && !!b.sku;
const standardDesigns=window.RODLOOM_STANDARD_DESIGNS;
let state = structuredClone(standardDesigns[0]);
let mode='rod', history=[], toastTimer;
let displayScale='actual', screenScale=3.25;
try {const stored=Number(localStorage.getItem('threadwrap-screen-scale'));if(stored>=1&&stored<=20)screenScale=stored;}catch{}
function updateScreenScale(){
 $('screen-scale').value=Number(screenScale.toFixed(3));
 $('calibration-ruler').style.width=`${50*screenScale}px`;
 draw();
}
$('display-scale').onchange=()=>{displayScale=$('display-scale').value;draw();};
$('inspect').onclick=()=>{displayScale=displayScale==='detail'?'actual':'detail';$('display-scale').value=displayScale;draw();};
$('screen-scale').oninput=()=>{const input=$('screen-scale');const value=Number(input.value);if(!Number.isFinite(value)||value<1||value>20)return;screenScale=value;$('calibration-ruler').style.width=`${50*screenScale}px`;try{localStorage.setItem('threadwrap-screen-scale',screenScale);}catch{}draw();};
const validColor = c => typeof c==='string' && /^#[0-9a-f]{6}$/i.test(c);
function validate(s){
 if(!s || typeof s.name!=='string' || s.name.length>80 || !Array.isArray(s.bands) || s.bands.length>100) throw Error('Invalid design');
 if(!Number.isFinite(s.coverage)||s.coverage<.05||s.coverage>1||!Number.isFinite(s.diameter)||s.diameter<1||s.diameter>50||!validColor(s.blank)) throw Error('Invalid dimensions');
 for(const b of s.bands) if(!b || typeof b.name!=='string'||b.name.length>80||!validColor(b.color)||!Number.isInteger(b.turns)||b.turns<1||b.turns>1000||!['regular','metallic','neon'].includes(b.finish)||typeof b.brand!=='string'||b.brand.length>40) throw Error('Invalid band');
 for(const b of s.bands){
  if(!isCatalogThread(b)||b.wrap==='spiral'&&!isCatalogThread(b.secondary))throw Error('Only Fuji and ProWrap catalog threads are supported');
  if(b.wrap!==undefined&&!['solid','spiral'].includes(b.wrap))throw Error('Invalid wrap type');
  if(b.wrap==='spiral'){
   const t=b.secondary;
   if(!t||typeof t.name!=='string'||t.name.length>80||!validColor(t.color)||!['regular','metallic','neon'].includes(t.finish)||typeof t.brand!=='string'||t.brand.length>40||![1,-1].includes(b.direction))throw Error('Invalid spiral');
  }
 }
 return {version:1,name:s.name,coverage:s.coverage,diameter:s.diameter,blank:s.blank,texture:!!s.texture,bands:s.bands.map(b=>({...b}))};
}
try {const saved=localStorage.getItem('threadwrap-design');if(saved) state=validate(JSON.parse(saved));} catch { /* Start with the default if stored data is unavailable. */ }
let cleanDesign=localStorageBaseline();
function localStorageBaseline(){
 try{
  const baseline=localStorage.getItem('threadwrap-clean-design');
  if(baseline)return baseline;
  const initial=JSON.stringify(state);localStorage.setItem('threadwrap-clean-design',initial);return initial;
 }catch{return JSON.stringify(state);}
}
function markClean(){
 cleanDesign=JSON.stringify(state);
 try{localStorage.setItem('threadwrap-clean-design',cleanDesign);}catch{}
}
function hasUnsavedChanges(){return JSON.stringify(state)!==cleanDesign;}
function confirmAction(message,title='Unsaved changes',accept='Discard changes'){
 const dialog=$('confirm-dialog');
 if(dialog.open)return Promise.resolve(false);
 $('confirm-title').textContent=title;$('confirm-message').textContent=message;$('confirm-accept').textContent=accept;
 return new Promise(resolve=>{
  const focus=document.activeElement;
  dialog.returnValue='';
  dialog.addEventListener('close',()=>{if(focus?.isConnected)focus.focus();resolve(dialog.returnValue==='accept');},{once:true});
  dialog.showModal();
 });
}
async function canReplaceDesign(){
 return !hasUnsavedChanges()||await confirmAction('Your current design has unsaved changes. Discard them and open another pattern? You can Undo this change.');
}
function notify(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function checkpoint(){history.push(structuredClone(state));if(history.length>50)history.shift();}
function persist(){try{localStorage.setItem('threadwrap-design',JSON.stringify(state));$('storage-status').textContent='Current draft autosaved in this browser';}catch{$('storage-status').textContent='Browser storage unavailable — use Export';}}
const libraryKey='threadwrap-designs';
function readLibrary(){
 const raw=localStorage.getItem(libraryKey);
 if(!raw)return [];
 const designs=JSON.parse(raw);
 if(!Array.isArray(designs))throw Error('Invalid saved designs');
 return designs.filter(design=>Array.isArray(design.bands)&&design.bands.every(b=>isCatalogThread(b)&&(b.wrap!=='spiral'||isCatalogThread(b.secondary)))).map(validate);
}
function renderLibrary(){renderStartingPoints();}
async function deleteDesign(name){
 if(!await confirmAction(`Delete “${name}” from this browser? This cannot be undone.`,'Delete saved design','Delete'))return;
 try{
  const designs=readLibrary().filter(item=>item.name!==name);
  localStorage.setItem(libraryKey,JSON.stringify(designs));renderLibrary();notify('Saved design deleted. Current draft kept.');
 }catch{notify('Could not delete the saved design.');}
}
function change(fn){checkpoint();fn();render();}
function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function render(){
 $('design-name').value=state.name;$('coverage').value=state.coverage;$('diameter').value=state.diameter;$('blank').value=state.blank;$('texture').checked=state.texture;
 $('preview-name').textContent=state.name||'Untitled design';$('band-count').textContent=`${state.bands.length} bands`;$('undo').disabled=!history.length;
 const list=$('bands');list.replaceChildren();
 if(!state.bands.length)list.append(make('p','hint','Choose Fuji or ProWrap thread colors from the catalog to start your design.'));
 // Display rightmost/latest bands first; keep stored bands in wrap order.
 state.bands.slice().reverse().forEach((b,position)=>{
  const i=state.bands.length-1-position;
  const row=make('div','band');row.dataset.index=i;
  const handle=make('button','drag-handle','⠿');handle.type='button';handle.title=`Drag to reorder band ${i+1}; or use the up/down arrows`;handle.setAttribute('aria-label',handle.title);
  handle.addEventListener('pointerdown',event=>startBandDrag(event,i,handle));row.append(handle);
  const color=make('input');color.type='color';color.value=b.color;color.setAttribute('aria-label',`Band ${i+1} color`);color.disabled=true;color.title='Catalog preview color (approximate)';
  const details=make('div','band-details');const name=make('input','name');name.value=b.name;name.maxLength=80;name.setAttribute('aria-label',`Band ${i+1} thread name`);name.readOnly=true;
  details.append(name);if(b.brand){const brand=make('small','brand-note',b.catalog?`${b.brand} · ${b.line || ''} · ${b.sku || ''}`:`${b.brand} · match unverified`);details.append(brand);}
  const turns=make('input','turns');turns.type='number';turns.min=1;turns.max=1000;turns.step=1;turns.value=b.turns;turns.setAttribute('aria-label',`Band ${i+1} turns`);turns.addEventListener('change',()=>{if(!turns.checkValidity()||!turns.value){turns.reportValidity();turns.value=b.turns;return;}change(()=>b.turns=Number(turns.value));});
  const tools=make('div','band-tools');for(const [label,icon,disabled,fn] of [['Move up','↑',i===state.bands.length-1,()=>[state.bands[i+1],state.bands[i]]=[state.bands[i],state.bands[i+1]]],['Move down','↓',i===0,()=>[state.bands[i-1],state.bands[i]]=[state.bands[i],state.bands[i-1]]],['Remove','×',false,()=>state.bands.splice(i,1)]]){const btn=make('button','',icon);btn.title=`${label} band ${i+1}`;btn.setAttribute('aria-label',btn.title);btn.disabled=disabled;btn.onclick=()=>change(fn);tools.append(btn);}
  row.append(color,details,turns,tools);
  if(b.wrap==='spiral'){
   row.classList.add('spiral-band');
   const paired=make('div','spiral-editor');
   paired.append(make('strong','spiral-label','Paired spiral · finished turns'));
   const second=make('input');second.type='color';second.value=b.secondary.color;second.setAttribute('aria-label',`Band ${i+1} second thread color`);second.disabled=true;second.title='Catalog preview color (approximate)';
   const secondName=make('input','name');secondName.value=b.secondary.name;secondName.maxLength=80;secondName.setAttribute('aria-label',`Band ${i+1} second thread name`);secondName.readOnly=true;
   const direction=make('select','finish');direction.setAttribute('aria-label',`Band ${i+1} spiral direction`);direction.append(new Option('Spiral /','1'),new Option('Spiral \\','-1'));direction.value=b.direction;direction.onchange=()=>change(()=>b.direction=Number(direction.value));
   paired.append(second,secondName,direction);
   row.append(paired);
  }else if(i<state.bands.length-1&&state.bands[i+1].wrap!=='spiral'){
   const transition=make('button','insert-spiral','＋ Spiral into next color');transition.onclick=()=>insertSpiral(i);row.append(transition);
  }
  list.append(row);
 });refresh();
}
function insertSpiral(index){
 if(state.bands.length>=100){notify('Maximum 100 bands per design.');return;}
 change(()=>{
  const outgoing=structuredClone(state.bands[index]),incoming=structuredClone(state.bands[index+1]);
  state.bands.splice(index+1,0,{...outgoing,wrap:'spiral',turns:5,secondary:incoming,direction:1});
 });
 notify('Added a 5-turn paired spiral using both neighboring colors.');
}
function startBandDrag(event,index,handle){
 if(event.button!==0)return;
 event.preventDefault();
 const row=handle.closest('.band'),list=$('bands');
 let destination=index;
 handle.setPointerCapture(event.pointerId);
 row.classList.add('dragging');
 function clearTargets(){list.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));}
 function move(e){
  clearTargets();
  const rows=[...list.children];
  const remaining=rows.filter(el=>el!==row);
  const insertion=remaining.findIndex(el=>{const r=el.getBoundingClientRect();return e.clientY<r.top+r.height/2;});
  const position=insertion<0?remaining.length:insertion;
  destination=remaining.length-position;
  if(destination!==index){
   if(insertion<0)remaining.at(-1)?.classList.add('drop-after');
   else remaining[insertion].classList.add('drop-before');
  }
 }
 function finish(e){
  handle.removeEventListener('pointermove',move);
  handle.removeEventListener('pointerup',finish);
  handle.removeEventListener('pointercancel',cancel);
  handle.removeEventListener('lostpointercapture',cancel);
  if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
  clearTargets();row.classList.remove('dragging');
  if(e.type==='pointerup'&&destination!==index){
   change(()=>{const [moved]=state.bands.splice(index,1);state.bands.splice(destination,0,moved);});
   $('bands').children[state.bands.length-1-destination].querySelector('.drag-handle').focus();
   notify(`Band moved to position ${destination+1}`);
  }
 }
 function cancel(e){finish(e);}
 handle.addEventListener('pointermove',move);
 handle.addEventListener('pointerup',finish);
 handle.addEventListener('pointercancel',cancel);
 handle.addEventListener('lostpointercapture',cancel);
}
function refresh(){
 $('undo').disabled=!history.length;
 const recipe=$('recipe');recipe.replaceChildren();let start=0;
 state.bands.forEach((b,i)=>{
  const tr=make('tr'),color=make('td'),metric=bandMetrics(b,state.coverage,state.diameter);
  for(const [j,thread] of (b.wrap==='spiral'?[b,b.secondary]:[b]).entries()){
   if(j)color.append(document.createTextNode(' + '));
   const swatch=make('span','swatch');swatch.style.background=thread.color;
   color.append(swatch,document.createTextNode(`${thread.name} — ${thread.finish}${thread.brand?' ('+thread.brand+(thread.catalog?' / '+(thread.line||'')+' / '+(thread.sku||''):', match unverified')+')':''}`));
  }
  if(b.wrap==='spiral')color.append(make('small','recipe-spiral',`Paired spiral ${b.direction===1?'/':'\\'} · wrap ${b.turns+1} pairs, then back off one turn of the first color and secure under the second. Finished estimate: ${b.turns} pairs. Keep the second color running.`));
  tr.append(make('td','',i+1),color,make('td','',b.wrap==='spiral'?`${b.turns} paired`:b.turns),make('td','',`${metric.length.toFixed(2)} mm`),make('td','',`${start.toFixed(2)}–${(start+metric.length).toFixed(2)} mm`));recipe.append(tr);start+=metric.length;
 });persist();draw();
}
function drawSpiral(ctx,b,x,top,width,height,pixelsPerMm){
 const strandWidth=state.coverage*pixelsPerMm,pitch=2*strandWidth;
 ctx.save();ctx.beginPath();ctx.rect(x,top,width,height);ctx.clip();
 const steps=mode==='flat'?1:48;
 for(let turn=-2;turn<=b.turns+1;turn++)for(const [strand,thread] of [b,b.secondary].entries()){
  const origin=x+turn*pitch+strand*strandWidth;
  ctx.beginPath();
  for(let step=0;step<=steps;step++){
   const f=step/steps,px=origin+spiralAdvance(f,pitch,mode==='flat',b.direction);
   if(step===0)ctx.moveTo(px,top);else ctx.lineTo(px,top+f*height);
  }
  for(let step=steps;step>=0;step--){const f=step/steps;ctx.lineTo(origin+strandWidth+spiralAdvance(f,pitch,mode==='flat',b.direction),top+f*height);}
  ctx.closePath();ctx.fillStyle=thread.color;ctx.fill();
  if(mode==='rod'||thread.finish==='metallic'){
   const shine=ctx.createLinearGradient(0,top,0,top+height);
   shine.addColorStop(0,'#0007');shine.addColorStop(.25,thread.finish==='metallic'?'#ffffffbb':'#ffffff30');shine.addColorStop(.48,'#ffffff05');shine.addColorStop(1,'#0008');
   ctx.fillStyle=shine;ctx.fill();
  }
  if(state.texture&&strandWidth>=1.2){ctx.strokeStyle='#00000025';ctx.lineWidth=Math.min(.5,strandWidth*.15);ctx.stroke();}
 }
 ctx.restore();
}
function reflectedBand(b){
 const copy=structuredClone(b);
 if(copy.wrap==='spiral'){
  const {secondary,wrap,direction,turns,...first}=copy;
  return {...secondary,wrap,turns,direction:-direction,secondary:first};
 }
 return copy;
}
function draw(target=$('preview'),exporting=false){
 const stage=$('preview').parentElement;
 const actual=!exporting&&displayScale!=='fit';
 const viewScale=screenScale*(displayScale==='detail'?4:1);
 if(!exporting){
  const inspecting=displayScale==='detail';
  const inspectLabel=inspecting?'Actual size':'Inspect 4×';
  $('inspect').title=inspectLabel;
  $('inspect').setAttribute('aria-label',inspectLabel);
  $('inspect').setAttribute('aria-pressed',String(inspecting));
 }
 const summary=wrapSummary(state.bands,state.coverage,state.diameter);
 const physicalLength=summary.length;
 const physicalHeight=mode==='flat'?Math.PI*(state.diameter+state.coverage):state.diameter+2*state.coverage;
 const w=exporting?1600:actual?Math.min(4000,Math.max(stage.clientWidth,physicalLength*viewScale+100)):stage.clientWidth;
 const h=exporting?640:actual?Math.max(280,physicalHeight*viewScale+160):280;
 const dpr=exporting?1:Math.min(2,window.devicePixelRatio||1);
 if(!exporting){target.style.width=`${w}px`;target.style.height=`${h}px`;} 
 target.width=w*dpr;target.height=h*dpr;const ctx=target.getContext('2d');ctx.scale(dpr,dpr);ctx.fillStyle=!exporting&&document.documentElement.dataset.theme==='dark'?'#303030':'#e6edf2';ctx.fillRect(0,0,w,h);
 const total=physicalLength/state.coverage;
 const {left,width,top,height,blankTop,blankHeight,pixelsPerMm,pitch}=wrapGeometry({turns:total,coverage:state.coverage,diameter:state.diameter,width:w,height:h,flat:mode==='flat',screenScale:actual?viewScale:null});
 const annotationColor=!exporting&&document.documentElement.dataset.theme==='dark'?'#bdbdbd':'#506b80';
 ctx.fillStyle=annotationColor;ctx.font=`${exporting?18:11}px sans-serif`;ctx.textAlign='center';
 const scaleLabel=actual?(displayScale==='detail'?'Magnified 4× · not actual size':'Actual size · accurate only after screen calibration'):'Proportional scale · auto-fit, not physical screen size';
 ctx.fillText(scaleLabel+(actual&&physicalLength*viewScale>w-100?' · clipped; use Fit':''),w/2,exporting?100:30);
 if(mode==='rod'){ctx.save();ctx.shadowColor='#00000045';ctx.shadowBlur=18;ctx.shadowOffsetY=12;ctx.fillStyle=state.blank;ctx.fillRect(0,blankTop,w,blankHeight);ctx.restore();}
 let x=left;
 state.bands.forEach(b=>{const bw=bandMetrics(b,state.coverage,state.diameter).length*pixelsPerMm;
  if(b.wrap==='spiral'){drawSpiral(ctx,b,x,top,bw,height,pixelsPerMm);x+=bw;return;}
  ctx.fillStyle=b.color;ctx.fillRect(x,top,bw,height);
  if(mode==='rod'){const shade=ctx.createLinearGradient(0,top,0,top+height);shade.addColorStop(0,'#0008');shade.addColorStop(.24,b.finish==='metallic'?'#ffffffbb':'#ffffff35');shade.addColorStop(.42,'#ffffff08');shade.addColorStop(1,'#0009');ctx.fillStyle=shade;ctx.fillRect(x,top,bw,height);}
  if(b.finish==='metallic'){const shine=ctx.createLinearGradient(x,top,x+bw,top+height);shine.addColorStop(0,'#fff0');shine.addColorStop(.35,'#fff0');shine.addColorStop(.46,'#ffffff88');shine.addColorStop(.5,'#ffffffc0');shine.addColorStop(.57,'#fff0');shine.addColorStop(1,'#0002');ctx.fillStyle=shine;ctx.fillRect(x,top,bw,height);}
  if(state.texture){if(pitch>=1.2){for(let n=0;n<b.turns;n++){const tx=x+n*pitch;ctx.fillStyle=b.finish==='metallic'?'#ffffff65':'#ffffff25';ctx.fillRect(tx,top,.6,height);ctx.fillStyle='#00000025';ctx.fillRect(tx+pitch-.6,top,.6,height);}}}
  x+=bw;
 });
 if(mode==='rod'){const shade=ctx.createLinearGradient(0,top,0,top+height);shade.addColorStop(0,'#0005');shade.addColorStop(.28,'#fff4');shade.addColorStop(.65,'#fff0');shade.addColorStop(1,'#0008');ctx.fillStyle=shade;ctx.fillRect(0,blankTop,left,blankHeight);ctx.fillRect(left+width,blankTop,w-left-width,blankHeight);}
 const ruler=top+height+30;ctx.strokeStyle=!exporting&&document.documentElement.dataset.theme==='dark'?'#909090':'#8b9eae';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,ruler);ctx.lineTo(left+width,ruler);ctx.moveTo(left,ruler-5);ctx.lineTo(left,ruler+5);ctx.moveTo(left+width,ruler-5);ctx.lineTo(left+width,ruler+5);ctx.stroke();ctx.fillStyle=annotationColor;ctx.font=`${exporting?18:11}px sans-serif`;ctx.textAlign='center';ctx.fillText(`${physicalLength.toFixed(2)} mm · ${summary.turns} finished revolutions`,w/2,ruler+20);
 ctx.save();ctx.translate(Math.max(16,left-18),top+height/2);ctx.rotate(-Math.PI/2);
 ctx.fillText(mode==='flat'?`${(height/pixelsPerMm).toFixed(2)} mm circumference`:`${state.diameter} mm blank`,0,0);ctx.restore();
 if(exporting){ctx.textAlign='left';ctx.font='bold 30px sans-serif';ctx.fillText(state.name||'Untitled design',left,65);ctx.font='18px sans-serif';ctx.fillText(`Size D · ${state.coverage} mm / turn · ${state.diameter} mm blank`,left,h-75);ctx.fillText('Rod Loom • colors and metallic effects are approximations',left,h-40);}
}
function addBand(b){
 if(!isCatalogThread(b)){notify('Choose a Fuji or ProWrap catalog thread.');return;}
 if(state.bands.length>=100){notify('Maximum 100 bands per design.');return;}
 change(()=>state.bands.push(structuredClone(b)));
 $('bands').closest('details').open=true;
 $('bands').firstElementChild.scrollIntoView({block:'start',inline:'nearest'});
}
$('mirror').onclick=()=>{if(state.bands.length*2>100){notify('Mirroring would exceed 100 bands.');return;}change(()=>state.bands.push(...state.bands.map(reflectedBand).reverse()));notify('Added a reversed copy of every band.');};
$('reverse').onclick=()=>change(()=>state.bands=state.bands.map(reflectedBand).reverse());$('undo').onclick=()=>{if(history.length){state=history.pop();render();}};
$('design-name').onchange=()=>change(()=>state.name=$('design-name').value);
for(const id of ['coverage','diameter']) $(id).onchange=()=>{if(!$(id).value||!$(id).checkValidity()){$(id).reportValidity();$(id).value=state[id];return;}change(()=>state[id]=Number($(id).value));};
$('blank').onfocus=checkpoint;$('blank').oninput=()=>{state.blank=$('blank').value;refresh();};$('texture').onchange=()=>change(()=>state.texture=$('texture').checked);
for(const m of ['rod','flat']) $(`${m}-mode`).onclick=()=>{mode=m;for(const other of ['rod','flat']){$(`${other}-mode`).classList.toggle('active',m===other);$(`${other}-mode`).setAttribute('aria-pressed',String(m===other));}draw();};
function renderStartingPoints(){
 const list=$('presets');list.replaceChildren();
 let saved=[];
 try{saved=readLibrary();}catch{list.append(make('p','hint','Saved designs unavailable. Export your current design for a backup.'));}
 for(const [custom,designs] of [[true,saved],[false,standardDesigns]])for(const preset of designs){
  const btn=make('button','preset'),strip=make('span','preset-strip');
  preset.bands.forEach(b=>{const s=make('span');s.style.background=b.color;s.style.flex=b.turns;strip.append(s);});
  btn.append(strip,make('span','preset-name',preset.name),make('small','',custom?'Saved in this browser':'Standard design'));
  btn.onclick=async()=>{
   if(!await canReplaceDesign())return;
   change(()=>{state=structuredClone(preset);});
   markClean();
  };
  const entry=make('div','library-entry');entry.append(btn);
  if(custom){
   const remove=make('button','icon-button library-delete');
   remove.title=`Delete ${preset.name}`;remove.setAttribute('aria-label',remove.title);
   remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
   remove.onclick=()=>deleteDesign(preset.name);entry.append(remove);
  }
  list.append(entry);
 }
}
const filename=()=> (state.name.trim().replace(/[^a-z0-9_-]+/gi,'-')||'rod-loom');
function download(blob,name){const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('save').onclick=async()=>{
 const name=$('design-name').value.trim();
 if(!name){notify('Give your design a name before saving.');$('design-name').focus();return;}
 try{
  const design=validate({...state,name}),designs=readLibrary();
  const index=designs.findIndex(item=>item.name===name);
  if(index>=0&&!await confirmAction(`Replace the saved design “${name}”?`,'Replace saved design','Replace'))return;
  if(index>=0)designs[index]=design;else designs.push(design);
  localStorage.setItem(libraryKey,JSON.stringify(designs));
  if(state.name!==name)change(()=>state.name=name);
  markClean();renderLibrary(name);notify('Design saved in this browser.');
 }catch{notify('Could not save in browser storage. Use Export for a backup.');}
};
$('export').onclick=()=>{download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`${filename()}.json`);notify('Design downloaded.');};
$('image').onclick=()=>{const canvas=make('canvas');draw(canvas,true);canvas.toBlob(blob=>{if(blob)download(blob,`${filename()}.png`);else notify('Could not export the image. Please try again.');});};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>250000)throw Error('File too large');const next=validate(JSON.parse(await file.text()));if(await canReplaceDesign()){change(()=>state=next);markClean();notify('Design opened.');}}catch{notify('Cannot open this file. Choose a valid Rod Loom design file.');}finally{$('file').value='';}};
document.querySelector('.starting-points').addEventListener('toggle',event=>{
 if(event.currentTarget.open)renderStartingPoints();
});
window.addEventListener('storage',event=>{
 if(event.key===libraryKey||event.key===null)renderLibrary();
});
window.addEventListener('themechange',()=>draw());
function updateRecipeImage(){
 const canvas=make('canvas');draw(canvas,true);
 $('recipe-image').src=canvas.toDataURL('image/png');
 $('recipe-title').textContent=`${state.name||'Untitled design'} — Wrapping recipe`;
}
function showView(recipe){
 if(recipe)updateRecipeImage();
 $('designer').hidden=recipe;$('recipe-page').hidden=!recipe;
 $('designer-view').setAttribute('aria-pressed',String(!recipe));
 $('recipe-view').setAttribute('aria-pressed',String(recipe));
 if(!recipe)draw();
 window.scrollTo(0,0);
}
$('designer-view').onclick=()=>showView(false);
$('recipe-view').onclick=()=>showView(true);
$('print').onclick=$('pdf').onclick=()=>{updateRecipeImage();window.print();};
window.addEventListener('beforeprint',updateRecipeImage);
new ResizeObserver(()=>{if(!$('designer').hidden)draw();}).observe($('preview').parentElement);render();updateScreenScale();renderLibrary();
