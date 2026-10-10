'use strict';
const $ = id => document.getElementById(id);
const isCatalogThread = b => b && b.catalog===true && ['Fuji','ProWrap'].includes(b.brand) && typeof b.sku==='string' && !!b.sku;
const standardDesigns=window.RODLOOM_STANDARD_DESIGNS;
let state = {...structuredClone(standardDesigns[0]),threadSize:'D'};
let mode='rod', rodSide='bottom', history=[], toastTimer;
let selectedBands=new Set(), bandClipboard=[];
const collapsedBandGroups=new Set();
let displayScale='actual', screenScale=3.25, zoom=1;
try {const stored=Number(localStorage.getItem('threadwrap-screen-scale'));if(stored>=1&&stored<=20)screenScale=stored;}catch{}
function updateScreenScale(updateInput=true){
 if(updateInput)$('screen-scale').value=Number(screenScale.toFixed(6));
 $('calibration-ruler').style.width=`${50*screenScale}px`;
 draw();
}
function updateZoomControls(){
 $('preview-zoom').value=zoom;
 $('zoom-value').textContent=displayScale==='fit'?'Fit':`${Number(zoom.toFixed(1))}×`;
 $('display-scale').value=displayScale;
}
$('display-scale').onchange=()=>{
 displayScale=$('display-scale').value;
 if(displayScale==='actual')zoom=1;
 if(displayScale==='detail'&&zoom===1)zoom=2;
 updateZoomControls();draw();
};
$('preview-zoom').oninput=()=>{
 const value=Number($('preview-zoom').value);
 if(!Number.isFinite(value)||value<1||value>8)return;
 zoom=value;displayScale=zoom===1?'actual':'detail';
 updateZoomControls();draw();
};
for(const side of ['bottom','side','top']) $(`${side}-view`).onclick=()=>{
 rodSide=side;
 for(const other of ['bottom','side','top']){
  $(`${other}-view`).classList.toggle('active',side===other);
  $(`${other}-view`).setAttribute('aria-pressed',String(side===other));
 }
 draw();
};
function saveScreenScale(value,updateInput=true){
 screenScale=value;
 try{localStorage.setItem('threadwrap-screen-scale',screenScale);}catch{}
 updateScreenScale(updateInput);
}
$('screen-scale').oninput=()=>{const value=Number($('screen-scale').value);if(!Number.isFinite(value)||value<1||value>20)return;saveScreenScale(value,false);};
$('apply-calibration').onclick=()=>{
 const input=$('measured-ruler');
 input.setCustomValidity('');
 const measured=Number(input.value);
 const value=screenScale*50/measured;
 if(!Number.isFinite(measured)||measured<=0||!Number.isFinite(value)||value<1||value>20){
  input.setCustomValidity('Enter the measured line length in mm (result must be 1–20 CSS pixels/mm).');
  input.reportValidity();return;
 }
 saveScreenScale(value);
 input.value='';
 notify('Calibration updated. Measure the line again to check it is 50 mm.');
};
$('measured-ruler').oninput=()=>$('measured-ruler').setCustomValidity('');
const validColor = c => typeof c==='string' && /^#[0-9a-f]{6}$/i.test(c);
function validate(s){
 if(!s || typeof s.name!=='string' || s.name.length>80 || !Array.isArray(s.bands) || s.bands.length>100) throw Error('Invalid design');
 if(s.threadSize!==undefined&&!['A','D'].includes(s.threadSize))throw Error('Invalid thread size');
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
 for(const b of s.bands)if(b.group!==undefined&&(typeof b.group!=='string'||!b.group.length||b.group.length>80))throw Error('Invalid band group');
 for(const b of s.bands)if(b.groupName!==undefined&&(typeof b.groupName!=='string'||b.groupName.length>80))throw Error('Invalid band group name');
 if(s.quickColors!==undefined&&(!Array.isArray(s.quickColors)||s.quickColors.length>500||s.quickColors.some(c=>!isCatalogThread(c)||typeof c.name!=='string'||c.name.length>80||!validColor(c.color)||!['regular','metallic','neon'].includes(c.finish)||c.sku.length>160||['line','code'].some(field=>c[field]!==undefined&&(typeof c[field]!=='string'||c[field].length>160)))))throw Error('Invalid quick palette');
 return {version:1,name:s.name,threadSize:s.threadSize||'D',coverage:s.coverage,diameter:s.diameter,blank:s.blank,texture:!!s.texture,bands:s.bands.map(b=>({...b})),...(s.quickColors!==undefined?{quickColors:s.quickColors.map(c=>({...c}))}:{})};
}
try {const saved=localStorage.getItem('threadwrap-design');if(saved) state=validate(JSON.parse(saved));} catch { /* Start with the default if stored data is unavailable. */ }
let cleanDesign=localStorageBaseline();
function localStorageBaseline(){
 try{
  const baseline=localStorage.getItem('threadwrap-clean-design');
  if(baseline)return JSON.stringify(validate(JSON.parse(baseline)));
  const initial=JSON.stringify(state);localStorage.setItem('threadwrap-clean-design',initial);return initial;
 }catch{return JSON.stringify(state);}
}
function markClean(){
 cleanDesign=JSON.stringify(state);
 $('save').hidden=true;
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
function persist(){$('save').hidden=!hasUnsavedChanges();try{localStorage.setItem('threadwrap-design',JSON.stringify(state));return true;}catch{notify('Browser storage unavailable — use Export to save your design.');return false;}}
const libraryKey='threadwrap-designs';
function readLibrary(){
 const raw=localStorage.getItem(libraryKey);
 if(!raw)return [];
 const designs=JSON.parse(raw);
 if(!Array.isArray(designs))throw Error('Invalid saved designs');
 return designs.filter(design=>Array.isArray(design.bands)&&design.bands.every(b=>isCatalogThread(b)&&(b.wrap!=='spiral'||isCatalogThread(b.secondary)))).map(validate);
}
function renderLibrary(){renderStartingPoints();}
async function deleteDesign(name,threadSize='D'){
 if(!await confirmAction(`Delete “${name}” (Size ${threadSize}) from this browser? This cannot be undone.`,'Delete saved design','Delete'))return;
 try{
  const designs=readLibrary().filter(item=>item.name!==name||item.threadSize!==threadSize);
  localStorage.setItem(libraryKey,JSON.stringify(designs));renderLibrary();notify('Saved design deleted. Current draft kept.');
 }catch{notify('Could not delete the saved design.');}
}
function change(fn){checkpoint();fn();render();}
function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function copyBandGroups(bands){
 const copies=structuredClone(bands),ids=new Map(),used=new Set(state.bands.map(b=>b.group));
 for(const b of copies)if(b.group){
  if(!ids.has(b.group)){let id=1;while(used.has(`group-${id}`))id++;ids.set(b.group,`group-${id}`);used.add(`group-${id}`);}
  b.group=ids.get(b.group);
 }
 return copies;
}
function bandBlock(index){
 const group=state.bands[index].group;
 let start=index,end=index;
 if(group){while(start>0&&state.bands[start-1].group===group)start--;while(end+1<state.bands.length&&state.bands[end+1].group===group)end++;}
 return {start,end};
}
function moveBandBlock(index,up){
 const block=bandBlock(index),neighbor=up?block.end+1:block.start-1;
 if(neighbor<0||neighbor>=state.bands.length)return;
 const other=bandBlock(neighbor);
 change(()=>{
  const bands=state.bands.splice(block.start,block.end-block.start+1);
  state.bands.splice(up?other.end-bands.length+1:other.start,0,...bands);
 });
}
function groupSelectedBands(){
 const indices=state.bands.map((b,i)=>selectedBands.has(b)?i:-1).filter(i=>i>=0);
 if(indices.length<2||indices.at(-1)-indices[0]+1!==indices.length){notify('Select two or more adjacent bands to group.');return;}
 const groups=new Set(indices.map(i=>state.bands[i].group).filter(Boolean));
 if(state.bands.some(b=>groups.has(b.group)&&!selectedBands.has(b))){notify('Select the entire existing group before regrouping.');return;}
 let id=1;while(state.bands.some(b=>b.group===`group-${id}`))id++;
 change(()=>{for(const i of indices){state.bands[i].group=`group-${id}`;delete state.bands[i].groupName;}});
}
function ungroupSelectedBands(){
 const groups=new Set(state.bands.filter(b=>selectedBands.has(b)).map(b=>b.group).filter(Boolean));
 if(groups.size)change(()=>{for(const b of state.bands)if(groups.has(b.group)){delete b.group;delete b.groupName;}});
}
async function deleteBandGroup(group){
 const design=state,bands=state.bands.filter(b=>b.group===group);
 if(!bands.length)return;
 const name=bands.find(b=>b.groupName)?.groupName||'Band group';
 if(!await confirmAction(`Delete “${name}” and all ${bands.length} bands in this group? You can Undo this change.`,'Delete band group','Delete'))return;
 // Do not delete a different design or newly created group after the dialog opens.
 if(state!==design)return;
 const targets=new Set(bands.filter(b=>b.group===group));
 if(!state.bands.some(b=>targets.has(b)))return;
 change(()=>{state.bands=state.bands.filter(b=>!targets.has(b));});
 collapsedBandGroups.delete(group);
 notify(`Deleted “${name}”.`);
}
function renameBandGroup(group,name){
 name=name.trim().slice(0,80);
 const bands=state.bands.filter(b=>b.group===group);
 if(!bands.length||bands.every(b=>(b.groupName||'')===name))return;
 change(()=>{for(const b of bands){if(name)b.groupName=name;else delete b.groupName;}});
}
let bandSelectionAnchor=null;
function selectBandRange(band,checked,shiftKey=false){
 const index=state.bands.indexOf(band),anchor=state.bands.indexOf(bandSelectionAnchor);
 const targets=shiftKey&&anchor>=0?state.bands.slice(Math.min(anchor,index),Math.max(anchor,index)+1):[band];
 for(const target of targets){if(checked)selectedBands.add(target);else selectedBands.delete(target);}
 if(!shiftKey||anchor<0)bandSelectionAnchor=band;
 for(const row of $('bands').querySelectorAll('.band'))row.querySelector('.select-band').checked=selectedBands.has(state.bands[Number(row.dataset.index)]);
 updateBlockControls();globalThis.colorWorkspace?.render();
}
function updateBlockControls(){
 $('group-bands').disabled=selectedBands.size<2;
 $('ungroup-bands').disabled=!state.bands.some(b=>selectedBands.has(b)&&b.group);
 $('copy-bands').disabled=!selectedBands.size;
 $('select-same-color').disabled=!selectedBands.size;
 $('clear-band-selection').disabled=!selectedBands.size;
 $('paste-bands').disabled=!bandClipboard.length||state.bands.length+bandClipboard.length>100;
 $('block-status').textContent=`${selectedBands.size} selected · ${bandClipboard.length} copied`;
}
function selectSameColor(){
 // Match catalog identity rather than approximate RGB, using the same visible
 // incoming thread that Replace selected targets for paired spirals.
 const key=b=>{const t=b.wrap==='spiral'?b.secondary:b;return JSON.stringify([t.brand,t.line||'',t.sku]);};
 const colors=new Set(state.bands.filter(b=>selectedBands.has(b)).map(key));
 if(!colors.size)return;
 selectedBands=new Set(state.bands.filter(b=>colors.has(key(b))));
 render();
 notify(`Selected ${selectedBands.size} bands with matching thread colors.`);
}
function replaceSelectedBands(thread){
 const targets=state.bands.filter(b=>selectedBands.has(b));
 if(!targets.length){notify('Select thread bands to replace first.');return false;}
 if(!isCatalogThread(thread)||!validColor(thread.color))return false;
 // Replace catalog metadata as well as preview color, retaining wrap geometry.
 const {turns,wrap,secondary,direction,...color}=thread;
 change(()=>{
  for(const band of targets){
   if(band.wrap==='spiral')band.secondary={...structuredClone(color),...(band.secondary.turns!==undefined?{turns:band.secondary.turns}:{})};
   else{
    const geometry={turns:band.turns,...(band.wrap?{wrap:band.wrap}:{}),...(band.group?{group:band.group,...(band.groupName?{groupName:band.groupName}:{})}:{})};
    for(const key of Object.keys(band))delete band[key];
    Object.assign(band,structuredClone(color),geometry);
   }
  }
 });
 notify(`Replaced ${targets.length} selected bands with ${thread.name}.`);
 return true;
}
function copySelectedBands(){
 if(!selectedBands.size)return;
 bandClipboard=structuredClone(state.bands.filter(b=>selectedBands.has(b)));
 updateBlockControls();notify(`Copied ${bandClipboard.length} bands in wrapping order.`);
}
function pasteBands(){
 if(!bandClipboard.length)return;
 if(state.bands.length+bandClipboard.length>100){notify('Pasting would exceed 100 bands.');return;}
 change(()=>{
  const copies=copyBandGroups(bandClipboard);
  state.bands.push(...copies);selectedBands=new Set(copies);
 });
 $('bands').closest('details').open=true;
 $('bands').firstElementChild.scrollIntoView({block:'start',inline:'nearest'});
 notify(`Pasted ${bandClipboard.length} bands at the end of the wrap. Adjust their turns below.`);
}
function revealPreviewBand(event){
 const canvas=$('preview'),rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
 const hit=canvas.bandRegions?.find(region=>x>=region.left&&x<region.right&&y>=region.top&&y<=region.bottom);
 if(!hit)return;
 const list=$('bands'),row=[...list.querySelectorAll('.band')].find(row=>Number(row.dataset.index)===hit.index);
 if(!row)return;
 list.closest('details').open=true;
 const group=row.closest('.band-group');
 if(group){group.open=true;collapsedBandGroups.delete(group.dataset.group);}
 list.querySelectorAll('.preview-highlight').forEach(row=>row.classList.remove('preview-highlight'));
 row.classList.add('preview-highlight');
 row.querySelector('.turns').focus({preventScroll:true});
 row.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
}
function bandColorChip(thread,label){
 const chip=make('button','band-color-chip');chip.type='button';chip.style.background=thread.color;
 chip.setAttribute('aria-label',`${label}: show ${thread.name} in Quick palette`);
 chip.title=`Show ${thread.name} in Quick palette`;
 chip.onclick=()=>globalThis.colorWorkspace?.revealQuick(thread);
 return chip;
}
function render(){
 selectedBands=new Set([...selectedBands].filter(b=>state.bands.includes(b)));
 if(!state.bands.includes(bandSelectionAnchor))bandSelectionAnchor=null;
 $('group-bands').onclick=groupSelectedBands;
 $('ungroup-bands').onclick=ungroupSelectedBands;
 $('copy-bands').onclick=copySelectedBands;
 $('select-same-color').onclick=selectSameColor;
 $('paste-bands').onclick=pasteBands;
 $('clear-band-selection').onclick=()=>{selectedBands.clear();bandSelectionAnchor=null;render();};
 updateBlockControls();
 $('thread-size').value=state.threadSize||'D';$('design-thread-size').textContent=`Size ${state.threadSize||'D'}`;
 $('design-name').value=state.name;$('coverage').value=state.coverage;$('diameter').value=state.diameter;$('blank').value=state.blank;$('texture').checked=state.texture;
 $('preview-name').textContent=state.name||'Untitled design';$('band-count').textContent=`${state.bands.length} bands`;$('undo').disabled=!history.length;
 const list=$('bands');list.replaceChildren();
 if(!state.bands.length)list.append(make('p','hint','Choose Fuji or ProWrap thread colors from the catalog to start your design.'));
 let groupContainer=null;
 // Display rightmost/latest bands first; keep stored bands in wrap order.
 state.bands.slice().reverse().forEach((b,position)=>{
  const i=state.bands.length-1-position;
  const row=make('div','band');row.dataset.index=i;
  const handle=make('button','drag-handle','⠿');handle.type='button';handle.title=`Drag to reorder band ${i+1} or drop inside a group to join it; or use the up/down arrows`;handle.setAttribute('aria-label',handle.title);
  handle.disabled=false;
  handle.addEventListener('pointerdown',event=>startBandDrag(event,i,handle));row.append(handle);
  // Match the bottom-to-top list: incoming thread above outgoing thread.
  const upper=b.wrap==='spiral'?b.secondary:b;
  const color=bandColorChip(upper,`Band ${i+1} ${b.wrap==='spiral'?'incoming thread ':''}color`);
  const details=make('div','band-details');const name=make('input','name');name.value=upper.name;name.maxLength=80;name.setAttribute('aria-label',`Band ${i+1} ${b.wrap==='spiral'?'incoming ':''}thread name`);name.readOnly=true;
  details.append(name);if(upper.brand){const brand=make('small','brand-note',upper.catalog?`${upper.brand} · ${upper.line || ''} · ${upper.sku || ''}`:`${upper.brand} · match unverified`);details.append(brand);}
  const turns=make('input','turns');turns.type='number';turns.min=1;turns.max=1000;turns.step=1;turns.value=b.turns;turns.setAttribute('aria-label',`Band ${i+1} turns`);turns.addEventListener('change',()=>{if(!turns.checkValidity()||!turns.value){turns.reportValidity();turns.value=b.turns;return;}change(()=>b.turns=Number(turns.value));});
  const tools=make('div','band-tools');for(const [label,icon,disabled,fn] of [['Move up','↑',bandBlock(i).end===state.bands.length-1,()=>moveBandBlock(i,true)],['Move down','↓',bandBlock(i).start===0,()=>moveBandBlock(i,false)],['Remove','×',false,()=>state.bands.splice(i,1)]]){const btn=make('button','',icon);btn.title=`${label} band ${i+1}`;btn.setAttribute('aria-label',btn.title);btn.disabled=disabled;btn.onclick=()=>label==='Remove'?change(fn):fn();if(b.group&&label!=='Remove'){btn.title=`${label} group`;btn.setAttribute('aria-label',btn.title);}tools.append(btn);}
  const clone=make('button','clone-band','⧉');clone.title=`Clone band ${i+1}`;clone.setAttribute('aria-label',clone.title);clone.onclick=()=>{if(addBand(b))notify(`Cloned ${b.wrap==='spiral'?'paired spiral':b.name}`);};tools.append(clone);
  const select=make('input','select-band');select.type='checkbox';select.checked=selectedBands.has(b);select.title=`Select band ${i+1}; Shift-click to select a range`;select.setAttribute('aria-label',select.title);
  let shiftSelection=false;
  select.onclick=event=>{shiftSelection=event.shiftKey;};
  select.onchange=()=>{selectBandRange(b,select.checked,shiftSelection);shiftSelection=false;};
  row.append(select,color,details,turns,tools);
  if(b.wrap==='spiral'){
   row.classList.add('spiral-band');
   const paired=make('div','spiral-editor');
   paired.append(make('strong','spiral-label','Paired spiral · finished turns'));
   const second=bandColorChip(b,`Band ${i+1} outgoing thread color`);
   const secondName=make('input','name');secondName.value=b.name;secondName.maxLength=80;secondName.setAttribute('aria-label',`Band ${i+1} outgoing thread name`);secondName.readOnly=true;
   const direction=make('select','finish');direction.setAttribute('aria-label',`Band ${i+1} spiral direction`);direction.append(new Option('Spiral /','1'),new Option('Spiral \\','-1'));direction.value=b.direction;direction.onchange=()=>change(()=>b.direction=Number(direction.value));
   paired.append(second,secondName,direction);
   row.append(paired);
  }else if(!b.group&&i<state.bands.length-1&&!state.bands[i+1].group&&state.bands[i+1].wrap!=='spiral'){
   const transition=make('button','insert-spiral','＋ Spiral into next color');transition.onclick=()=>insertSpiral(i);row.append(transition);
  }
  if(b.group){
   row.classList.add('grouped-band');row.dataset.group=b.group;
   const block=bandBlock(i);
   if(block.end===i){
    groupContainer=make('details','band-group');groupContainer.dataset.group=b.group;
    groupContainer.dataset.index=block.start;groupContainer.dataset.end=block.end;
    groupContainer.open=!collapsedBandGroups.has(b.group);
    const container=groupContainer;
    container.addEventListener('toggle',()=>{if(!container.isConnected)return;if(container.open)collapsedBandGroups.delete(b.group);else collapsedBandGroups.add(b.group);});
    const header=make('summary','band-group-header');
    const drag=make('button','drag-handle','⠿');drag.type='button';drag.title='Drag to reorder band group';drag.setAttribute('aria-label',drag.title);
    drag.addEventListener('pointerdown',event=>startBandDrag(event,i,drag));drag.onclick=event=>event.preventDefault();
    const title=make('input','band-group-title');title.type='text';title.value=b.groupName||'';title.placeholder='Band group';title.maxLength=80;title.setAttribute('aria-label','Band group name');title.title='Rename band group';
    title.onclick=event=>event.stopPropagation();
    title.onchange=()=>renameBandGroup(b.group,title.value);
    title.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();title.blur();}else if(event.key==='Escape'){event.preventDefault();title.value=b.groupName||'';title.blur();}};
    header.append(drag,title,make('span','band-group-count',`${block.end-block.start+1} bands`));
    for(const [label,icon,disabled,fn] of [['Move group up','↑',block.end===state.bands.length-1,()=>moveBandBlock(i,true)],['Move group down','↓',block.start===0,()=>moveBandBlock(i,false)],['Ungroup','',false,()=>change(()=>{for(const band of state.bands)if(band.group===b.group){delete band.group;delete band.groupName;}})],['Delete group','',false,()=>deleteBandGroup(b.group)]]){
     const button=make('button','group-action',icon);button.type='button';button.title=label;button.setAttribute('aria-label',label);button.disabled=disabled;
     if(label==='Ungroup'||label==='Delete group'){
      button.classList.add('group-action-icon');
      const path=label==='Delete group'?'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7':'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M8 8h3v3H8zM13 13h3v3h-3z';
      button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
     }
     button.onclick=event=>{event.preventDefault();return fn();};header.append(button);
    }
    groupContainer.append(header);list.append(groupContainer);
   }
   groupContainer.append(row);
  }else{groupContainer=null;list.append(row);}
 });refresh();globalThis.colorWorkspace?.render();
}
function insertSpiral(index){
 if(state.bands.length>=100){notify('Maximum 100 bands per design.');return;}
 change(()=>{
  const outgoing=structuredClone(state.bands[index]),incoming=structuredClone(state.bands[index+1]);
  const group=outgoing.group===incoming.group?outgoing.group:undefined,groupName=group?outgoing.groupName:undefined;
  delete outgoing.group;delete incoming.group;delete outgoing.groupName;delete incoming.groupName;
  state.bands.splice(index+1,0,{...outgoing,...(group?{group,...(groupName?{groupName}:{})}:{}),wrap:'spiral',turns:5,secondary:incoming,direction:1});
 });
 notify('Added a 5-turn paired spiral using both neighboring colors.');
}
function startBandDrag(event,index,handle){
 if(event.button!==0)return;
 event.preventDefault();
 const bandRow=handle.closest('.band'),row=bandRow||handle.closest('.band-group'),list=$('bands');
 const individual=!!bandRow;
 const block=individual?{start:index,end:index}:bandBlock(index),count=block.end-block.start+1;
 let destination=block.start,targetGroup=individual?(state.bands[index].group||null):null;
 const sourceBand=state.bands[index];
 const rect=row.getBoundingClientRect(),ghost=row.cloneNode(true);
 ghost.classList.add('band-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
 ghost.style.width=`${rect.width||320}px`;
 const offsetX=Number.isFinite(event.clientX)?event.clientX-(rect.left||0):0;
 const offsetY=Number.isFinite(event.clientY)?event.clientY-rect.top:0;
 function positionGhost(e){
  ghost.style.left=`${(Number.isFinite(e.clientX)?e.clientX:(rect.left||0))-offsetX}px`;
  ghost.style.top=`${(Number.isFinite(e.clientY)?e.clientY:rect.top)-offsetY}px`;
 }
 positionGhost(event);document.body.append(ghost);
 handle.setPointerCapture(event.pointerId);
 row.classList.add('dragging');
 function clearTargets(){list.querySelectorAll('.drop-before,.drop-after,.drop-into').forEach(el=>{for(const cls of ['drop-before','drop-after','drop-into'])el.classList.remove(cls);});}
 function move(e){
  positionGhost(e);
  clearTargets();targetGroup=null;
  const rows=[...list.children];
  // Group-header drags move whole blocks; band handles move individual colors.
  if(individual){
   const group=rows.find(el=>{
    if(!el.dataset.group||!state.bands.some(b=>b.group===el.dataset.group&&b!==sourceBand))return false;
    const r=el.getBoundingClientRect();
    return e.clientY>=r.top+8&&e.clientY<=r.top+r.height-8;
   });
   if(group){
    targetGroup=group.dataset.group;
    let insertion=Number(group.dataset.end)+1;
    if(group.open){
     const bands=[...group.querySelectorAll('.band')].filter(el=>el!==row);
     const target=bands.find(el=>{const r=el.getBoundingClientRect();return e.clientY<r.top+r.height/2;});
     insertion=target?Number(target.dataset.index)+1:Number(group.dataset.index);
     if(target)target.classList.add('drop-before');
     else bands.at(-1)?.classList.add('drop-after');
    }
    destination=insertion-(block.start<insertion?count:0);
    group.classList.add('drop-into');
    return;
   }
  }
  const size=el=>Number(el.dataset.end??el.dataset.index)-Number(el.dataset.index)+1-(individual&&sourceBand.group&&el.dataset.group===sourceBand.group?1:0);
  const remaining=rows.filter(el=>el!==row&&size(el)>0);
  const insertion=remaining.findIndex(el=>{const r=el.getBoundingClientRect();return e.clientY<r.top+r.height/2;});
  const position=insertion<0?remaining.length:insertion;
  destination=remaining.slice(position).reduce((total,el)=>total+size(el),0);
  if(destination!==block.start){
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
  ghost.remove();
  clearTargets();row.classList.remove('dragging');
  if(e.type==='pointerup'&&(destination!==block.start||(individual&&(targetGroup||undefined)!==sourceBand.group))){
   const groupName=targetGroup?state.bands.find(b=>b.group===targetGroup)?.groupName:undefined;
   change(()=>{
    const moved=state.bands.splice(block.start,count);
    if(individual)for(const band of moved){
     if(targetGroup){band.group=targetGroup;if(groupName)band.groupName=groupName;else delete band.groupName;}
     else{delete band.group;delete band.groupName;}
    }
    state.bands.splice(destination,0,...moved);
   });
   const movedRow=[...(individual?$('bands').querySelectorAll('.band'):$('bands').children)].find(el=>Number(el.dataset.index)===destination);
   movedRow?.querySelector('.drag-handle')?.focus();
   notify(targetGroup?`Added band to “${groupName||'Band group'}”.`:`${count>1?'Band group':'Band'} moved to position ${destination+1}`);
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
   const f=step/steps,px=origin+spiralAdvance(rodSide==='side'?1-f:f,pitch,mode==='flat',b.direction,rodSide==='top'?.5:rodSide==='side'?.25:0);
   if(step===0)ctx.moveTo(px,top);else ctx.lineTo(px,top+f*height);
  }
  for(let step=steps;step>=0;step--){const f=step/steps;ctx.lineTo(origin+strandWidth+spiralAdvance(rodSide==='side'?1-f:f,pitch,mode==='flat',b.direction,rodSide==='top'?.5:rodSide==='side'?.25:0),top+f*height);}
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
  const {secondary,wrap,direction,turns,group,groupName,...first}=copy;
  return {...secondary,wrap,turns,direction:-direction,secondary:first,...(group?{group,...(groupName?{groupName}:{})}:{})};
 }
 return copy;
}
function draw(target=$('preview'),exporting=false){
 const stage=$('preview').parentElement;
 if(!exporting)target.bandRegions=[];
 const actual=!exporting&&displayScale!=='fit';
 const viewScale=screenScale*zoom;
 if(!exporting)$('preview').setAttribute('aria-label',`${rodSide[0].toUpperCase()+rodSide.slice(1)} ${mode==='flat'?'flat layout':'rod view'} of your thread wrapping pattern`);
 const summary=wrapSummary(state.bands,state.coverage,state.diameter);
 const physicalLength=summary.length;
 const physicalHeight=mode==='flat'?Math.PI*(state.diameter+state.coverage):state.diameter+2*state.coverage;
 // Allow wide actual-size wraps to scroll horizontally, never vertically.
 const w=exporting?1600:actual?Math.min(4000,Math.max(stage.clientWidth,physicalLength*viewScale+100)):stage.clientWidth;
 const h=exporting?640:stage.clientHeight;
 const dpr=exporting?1:Math.min(2,window.devicePixelRatio||1);
 if(!exporting){target.style.width=`${w}px`;target.style.height=`${h}px`;} 
 target.width=w*dpr;target.height=h*dpr;const ctx=target.getContext('2d');ctx.scale(dpr,dpr);ctx.fillStyle=!exporting&&document.documentElement.dataset.theme==='dark'?'#303030':'#e6edf2';ctx.fillRect(0,0,w,h);
 const total=physicalLength/state.coverage;
 const {left,width,top,height,blankTop,blankHeight,pixelsPerMm,pitch}=wrapGeometry({turns:total,coverage:state.coverage,diameter:state.diameter,width:w,height:h,flat:mode==='flat',screenScale:actual?viewScale:null});
 const annotationColor=!exporting&&document.documentElement.dataset.theme==='dark'?'#bdbdbd':'#506b80';
 ctx.fillStyle=annotationColor;ctx.font=`${exporting?18:11}px sans-serif`;ctx.textAlign='center';
 const scaleLabel=actual?(zoom!==1?`Magnified ${Number(zoom.toFixed(1))}× · not actual size`:'Actual size · accurate only after screen calibration'):'Proportional scale · auto-fit, not physical screen size';
 ctx.fillText(`${rodSide[0].toUpperCase()+rodSide.slice(1)} view · `+scaleLabel+(actual&&(physicalLength*viewScale>w-100||physicalHeight*viewScale>h-160)?' · clipped; use Fit':''),w/2,exporting?100:30);
 if(mode==='rod'||!state.bands.length){ctx.save();ctx.shadowColor='#00000045';ctx.shadowBlur=18;ctx.shadowOffsetY=12;ctx.fillStyle=state.blank;ctx.fillRect(0,blankTop,w,blankHeight);ctx.restore();}
 // An empty design shows only the bare blank, without thread shading or wrap rulers.
 if(!state.bands.length){
  ctx.fillStyle=annotationColor;
  ctx.fillText('Bare rod · choose thread colors to start',w/2,h-30);
  return;
 }
 let x=left;
 state.bands.forEach((b,index)=>{const bw=bandMetrics(b,state.coverage,state.diameter).length*pixelsPerMm;
  if(!exporting)target.bandRegions.push({index,left:x/w,right:(x+bw)/w,top:top/h,bottom:(top+height)/h});
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
 if(exporting){ctx.textAlign='left';ctx.font='bold 30px sans-serif';ctx.fillText(state.name||'Untitled design',left,65);ctx.font='18px sans-serif';ctx.fillText(`Size ${state.threadSize||'D'} · ${state.coverage} mm / turn · ${state.diameter} mm blank`,left,h-75);ctx.fillText('Rod Loom • colors and metallic effects are approximations',left,h-40);}
}
function addBand(b,{reveal=true}={}){
 if(!isCatalogThread(b)){notify('Choose a Fuji or ProWrap catalog thread.');return false;}
 if(state.bands.length>=100){notify('Maximum 100 bands per design.');return false;}
 change(()=>{const copy=structuredClone(b);delete copy.group;delete copy.groupName;state.bands.push(copy);});
 $('bands').closest('details').open=true;
 if(reveal)$('bands').firstElementChild.scrollIntoView({block:'start',inline:'nearest'});
 return true;
}
$('mirror').onclick=()=>{if(state.bands.length*2>100){notify('Mirroring would exceed 100 bands.');return;}change(()=>state.bands.push(...copyBandGroups(state.bands.map(reflectedBand).reverse())));notify('Added a reversed copy of every band.');};
$('reverse').onclick=()=>change(()=>state.bands=state.bands.map(reflectedBand).reverse());$('undo').onclick=()=>{if(history.length){state=history.pop();render();}};
$('design-name').onchange=()=>change(()=>state.name=$('design-name').value);
$('thread-size').onchange=async()=>{
 const target=$('thread-size').value,previous=state;
 $('thread-size').value=state.threadSize||'D';
 if(!['A','D'].includes(target)||target===(state.threadSize||'D'))return;
 const coverage=target==='A'?.15:.25;
 if(state.bands.length&&!await confirmAction(`Convert this design from Size ${state.threadSize||'D'} to Size ${target}? Coverage will reset to ${coverage} mm per turn. Turn counts stay unchanged, so wrap widths and thread estimates will change. Catalog colors are retained; verify matching Size ${target} products separately. You can Undo this change.`,'Convert thread size','Convert'))return;
 if(state!==previous)return;
 change(()=>{state.threadSize=target;state.coverage=coverage;});
};
for(const id of ['coverage','diameter']) $(id).onchange=()=>{if(!$(id).value||!$(id).checkValidity()){$(id).reportValidity();$(id).value=state[id];return;}change(()=>state[id]=Number($(id).value));};
$('blank').onfocus=checkpoint;$('blank').oninput=()=>{state.blank=$('blank').value;refresh();};$('texture').onchange=()=>change(()=>state.texture=$('texture').checked);
for(const m of ['rod','flat']) $(`${m}-mode`).onclick=()=>{mode=m;for(const other of ['rod','flat']){$(`${other}-mode`).classList.toggle('active',m===other);$(`${other}-mode`).setAttribute('aria-pressed',String(m===other));}draw();};
function startNewDesign(){
 change(()=>{state={...state,name:'',blank:'#101314',bands:[]};});
 markClean();
 $('bands').closest('details').open=true;
 $('design-name').focus();
 notify('Started a blank design. Quick palette kept. Undo to restore your previous design.');
}
$('new-design').onclick=startNewDesign;
function renderStartingPoints(){
 const list=$('presets');list.replaceChildren();
 let saved=[];
 try{saved=readLibrary();}catch{list.append(make('p','hint','Saved designs unavailable. Export your current design for a backup.'));}
 for(const [custom,designs] of [[true,saved],[false,standardDesigns]])for(const preset of designs){
  const btn=make('button','preset'),strip=make('span','preset-strip');
  preset.bands.forEach(b=>{const s=make('span');s.style.background=b.color;s.style.flex=b.turns;strip.append(s);});
  btn.append(strip,make('span','preset-name',preset.name),make('small','',`${custom?'Saved in this browser':'Standard design'} · Size ${preset.threadSize||'D'}`));
  btn.onclick=async()=>{
   if(!await canReplaceDesign())return;
   change(()=>{state={...validate(structuredClone(preset)),quickColors:structuredClone(preset.quickColors||[])};});
   markClean();
  };
  const entry=make('div','library-entry');entry.append(btn);
  if(custom){
   const remove=make('button','icon-button library-delete');
   remove.title=`Delete ${preset.name} (Size ${preset.threadSize||'D'})`;remove.setAttribute('aria-label',remove.title);
   remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
   remove.onclick=()=>deleteDesign(preset.name,preset.threadSize||'D');entry.append(remove);
  }
  list.append(entry);
 }
}
const filename=()=> (state.name.trim().replace(/[^a-z0-9_-]+/gi,'-')||'rod-loom')+`-size-${(state.threadSize||'D').toLowerCase()}`;
function download(blob,name){const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('save').onclick=async()=>{
 const name=$('design-name').value.trim();
 if(!name){notify('Give your design a name before saving.');$('design-name').focus();return;}
 try{
  const design=validate({...state,name}),designs=readLibrary();
  const index=designs.findIndex(item=>item.name===name&&item.threadSize===design.threadSize);
  if(index>=0&&!await confirmAction(`Replace the saved design “${name}” (Size ${design.threadSize})?`,'Replace saved design','Replace'))return;
  if(index>=0)designs[index]=design;else designs.push(design);
  localStorage.setItem(libraryKey,JSON.stringify(designs));
  if(state.name!==name)change(()=>state.name=name);
  markClean();renderLibrary(name);notify('Design saved in this browser.');
 }catch{notify('Could not save in browser storage. Use Export for a backup.');}
};
$('export').onclick=()=>{download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`${filename()}.json`);notify('Design downloaded.');};
$('image').onclick=()=>{const canvas=make('canvas');draw(canvas,true);canvas.toBlob(blob=>{if(blob)download(blob,`${filename()}.png`);else notify('Could not export the image. Please try again.');});};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>250000)throw Error('File too large');const next=validate(JSON.parse(await file.text()));if(await canReplaceDesign()){change(()=>state={...next,quickColors:next.quickColors||[]});markClean();notify('Design opened.');}}catch{notify('Cannot open this file. Choose a valid Rod Loom design file.');}finally{$('file').value='';}};
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
$('preview').onclick=revealPreviewBand;
$('preview').title='Click a thread color to find its band in Thread bands';
new ResizeObserver(()=>{if(!$('designer').hidden)draw();}).observe($('preview').parentElement);render();updateScreenScale();renderLibrary();
