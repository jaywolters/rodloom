'use strict';
// Color identity is a catalog thread, not an RGB value: similar shades can be different products.
(function(root){
 const limit=500;
 function thread(value){
  if(!value||value.catalog!==true||!['Fuji','ProWrap'].includes(value.brand)||
   typeof value.sku!=='string'||!value.sku||value.sku.length>160||
   typeof value.name!=='string'||value.name.length>80||
   typeof value.color!=='string'||!/^#[0-9a-f]{6}$/i.test(value.color)||
   !['regular','metallic','neon'].includes(value.finish))return null;
  const result={catalog:true,brand:value.brand,sku:value.sku,name:value.name,color:value.color,finish:value.finish};
  for(const field of ['line','code'])if(typeof value[field]==='string'&&value[field].length<=160)result[field]=value[field];
  if(typeof value.source==='string'&&value.source.length<=2000&&/^https?:\/\//.test(value.source))result.source=value.source;
  if(typeof value.paletteLetter==='string'&&/^[A-Z]{1,3}$/.test(value.paletteLetter))result.paletteLetter=value.paletteLetter;
  return result;
 }
 function letter(index){
  let result='';
  do{result=String.fromCharCode(65+index%26)+result;index=Math.floor(index/26)-1;}while(index>=0);
  return result;
 }
 function labelPalette(values,newestFirst=true){
  const used=new Set(),result=values.map(value=>({...value}));
  for(const value of result){
   if(/^[A-Z]{1,3}$/.test(value.paletteLetter)&&!used.has(value.paletteLetter))used.add(value.paletteLetter);
   else delete value.paletteLetter;
  }
  // New colors appear first in the shelf; assign letters in collection order.
  for(const value of (newestFirst?result.slice().reverse():result))if(!value.paletteLetter){
   let index=0;while(used.has(letter(index)))index++;
   value.paletteLetter=letter(index);used.add(value.paletteLetter);
  }
  return result;
 }
 function parsePatternDefinition(text){
  const tokens=text.trim().split(/[,\n]+/);
  if(!text.trim())throw Error('Type a pattern first.');
  return tokens.map((token,index)=>{
   const match=token.trim().toUpperCase().match(/^(\d+)\s*([/\\]?)\s*([A-Z]+(?:\s*\+\s*[A-Z]+)?)$/);
   if(!match)throw Error(`Band ${index+1}: use 12A, 4/AB, or 4\\AB.`);
   const turns=Number(match[1]),direction=match[2],code=match[3];
   if(!Number.isInteger(turns)||turns<1||turns>1000)throw Error(`Band ${index+1}: turns must be 1–1000.`);
   const letters=direction?(code.includes('+')?code.split(/\s*\+\s*/):code.length===2?[...code]:[]):[code];
   if(letters.length!==(direction?2:1))throw Error(`Band ${index+1}: a spiral needs two colors (AB or A+B).`);
   return {turns,direction,letters};
  });
 }
 function parsePattern(text,palette){
  const definition=parsePatternDefinition(text);
  const lookup=new Map(labelPalette(palette).map(value=>[value.paletteLetter,value]));
  return definition.map(({turns,direction,letters},index)=>{
   const threads=letters.map(label=>{
    const value=thread(lookup.get(label));
    if(!value)throw Error(`Band ${index+1}: color ${label} is not in the quick palette.`);
    delete value.paletteLetter;return value;
   });
   return {...threads[0],turns,...(direction?{wrap:'spiral',secondary:threads[1],direction:direction==='/'?1:-1}:{})};
  });
 }
 const key=value=>JSON.stringify([value.brand,value.line||'',value.sku]);
 function unique(values){
  const result=new Map();
  for(const value of values){const color=thread(value);if(color)result.set(key(color),color);}
  return [...result.values()].slice(0,limit);
 }
 function fromBands(bands){return unique(bands.flatMap(b=>b.wrap==='spiral'?[b,b.secondary]:[b]));}
 function toBand(value){const color=thread(value);if(color)delete color.paletteLetter;return color?{...color,turns:color.finish==='metallic'?5:10}:null;}
 function decode(raw){
  if(!raw)return {quick:[],favorites:[]};
  const data=JSON.parse(raw);
  if(!data||![1,2].includes(data.version)||!Array.isArray(data.favorites)||data.version===1&&!Array.isArray(data.quick))throw Error('Invalid color library');
  return {quick:data.version===1?unique(data.quick):[],favorites:unique(data.favorites)};
 }
 function decodePatterns(raw){
  if(!raw)return [];
  const data=JSON.parse(raw);
  if(!data||data.version!==1||!Array.isArray(data.patterns)||data.patterns.length>100)throw Error('Invalid saved patterns');
  const names=new Set();
  for(const item of data.patterns){
   if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||typeof item.text!=='string'||!item.text.trim()||item.text.length>10000||names.has(item.name.toLowerCase()))throw Error('Invalid saved pattern');
   names.add(item.name.toLowerCase());
  }
  return data.patterns.map(({name,text})=>({name,text}));
 }
 const api={limit,thread,key,unique,fromBands,toBand,decode,letter,labelPalette,parsePatternDefinition,parsePattern,decodePatterns};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ThreadColors=api;
})(typeof window==='undefined'?globalThis:window);

if(typeof window!=='undefined'&&typeof document!=='undefined')(() => {
 const colors=window.ThreadColors,storageKey='rodloom-colors-v1';
 let library={quick:[],favorites:[]},highlightedQuick=null;
 function storageWarning(message){$('color-storage-status').hidden=!message;$('color-storage-status').textContent=message;}
 function load(){
  try{library=colors.decode(localStorage.getItem(storageKey));storageWarning('');}
  catch{storageWarning('Saved colors unavailable. Colors collected now will stay in this session until browser storage is available.');}
 }
 const collection=section=>section==='quick'?colors.labelPalette(state.quickColors||[]):library.favorites;
 const contains=(section,value)=>collection(section).some(item=>colors.key(item)===colors.key(value));
 function save(){
  try{localStorage.setItem(storageKey,JSON.stringify({version:2,favorites:library.favorites}));storageWarning('');}
  catch{storageWarning('Colors are only saved for this session. Browser storage is unavailable or full.');}
  render();window.dispatchEvent(new Event('colorschange'));
 }
 function orderedPalette(values){return values.map((item,index)=>({...item,paletteLetter:colors.letter(index)}));}
 function toggle(section,value){
  const color=colors.thread(value);if(!color)return;
  delete color.paletteLetter;
  const current=collection(section);
  if(!contains(section,color)&&current.length>=colors.limit){notify(`Maximum ${colors.limit} saved colors. Remove a color first.`);return;}
  const next=contains(section,color)?current.filter(item=>colors.key(item)!==colors.key(color)):section==='quick'?[color,...current]:[...current,color];
  if(section==='quick'){
   change(()=>{state.quickColors=orderedPalette(next);});
  }else{library.favorites=next;save();}
 }
 const paletteTabs=[['quick','quick-colors-tab','quick-colors-panel'],['favorite','favorite-colors-tab','favorite-colors-panel'],['patterns','type-pattern','patterns-panel']];
 function moveQuick(value,offset){
  const next=collection('quick'),index=next.findIndex(item=>colors.key(item)===colors.key(value)),target=index+offset;
  if(index<0||target<0||target>=next.length)return;
  [next[index],next[target]]=[next[target],next[index]];
  change(()=>{state.quickColors=orderedPalette(next);});
  notify('Palette reordered and letters reassigned. Existing bands are unchanged. Undo to restore.');
 }
 function selectTab(name,focus=false){
  for(const [key,tabId,panelId] of paletteTabs){
   const selected=key===name,tab=$(tabId);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
   $(panelId).hidden=!selected;if(selected&&focus)tab.focus();
  }
  if(name==='patterns'){
   $('pattern-save-status').textContent='';loadNamedPatterns();renderNamedPatterns();askToSavePattern();renderPatternPalette();
  }
 }
 function revealQuick(value){
  const color=colors.thread(value);if(!color)return;
  if(!contains('quick',color)&&collection('quick').length>=colors.limit){notify(`Maximum ${colors.limit} saved colors. Remove a color first.`);return;}
  highlightedQuick=colors.key(color);
  if(!contains('quick',color))change(()=>{state.quickColors=orderedPalette([color,...collection('quick')]);});
  else render();
  selectTab('quick');
  $('quick-colors-panel').closest('details').open=true;
  const row=[...$('quick-colors').children].find(el=>el.dataset.colorKey===highlightedQuick);
  if(row){[...row.children].find(el=>el.className==='saved-color-choice').focus({preventScroll:true});row.scrollIntoView({block:'center',inline:'nearest'});}
 }
 function add(value){
  const band=colors.toBand(value);
  if(band&&addBand(band,{reveal:false}))notify(`${band.name} added to design`);
 }
 function describe(value){return `${value.brand} · ${value.line||'Size D'} · ${value.sku}`;}
 function swatch(value){const chip=make('span','color-chip');chip.style.background=value.color;chip.setAttribute('aria-hidden','true');return chip;}
 function action(label,text,fn,id){
  const button=make('button','color-action',text);button.type='button';button.title=label;button.setAttribute('aria-label',label);button.onclick=fn;button.dataset.colorControl=id;return button;
 }
 function renderShelf(section,id){
  const list=$(id),values=collection(section);list.replaceChildren();
  if(!values.length){list.append(make('p','color-empty',section==='quick'?'Collect threads with + Palette in the catalog, or clone the colors from your design.':'No favorites yet. Star a color in your quick palette or the catalog.'));return;}
  for(const [index,value] of values.entries()){
   const identity=colors.key(value),row=make('div',section==='quick'&&identity===highlightedQuick?'saved-color quick-highlight':'saved-color');
   row.dataset.colorKey=identity;
   const choose=action(`Add ${section==='quick'?value.paletteLetter+': ':''}${value.name} — ${describe(value)}`,'',()=>add(value),`${section}-add-${identity}`);choose.className='saved-color-choice';
   const label=make('span','saved-color-label'),name=make('span','saved-color-name');
   if(section==='quick')name.append(make('span','palette-letter',value.paletteLetter));
   name.append(make('strong','',value.name));label.append(name,make('small','',describe(value)));
   if(section==='quick'&&selectedBands.size){
    const replace=action(`Replace selected bands with ${value.name}`,'⇄',()=>replaceSelectedBands(value),`${section}-replace-${identity}`);
    replace.className='color-action color-replace';row.append(replace);
   }
   choose.append(swatch(value),label);row.append(choose);
   const favorite=contains('favorites',value);
   const star=action(`${favorite?'Unfavorite':'Favorite'} ${value.name}`,favorite?'★':'☆',()=>toggle('favorites',value),`${section}-star-${identity}`);
   star.setAttribute('aria-pressed',String(favorite));row.append(star);
   if(section==='quick'){
    row.append(action(`Remove ${value.name} from this design's quick palette`,'×',()=>toggle('quick',value),`${section}-remove-${identity}`));
    for(const [offset,label,symbol] of [[-1,'up','↑'],[1,'down','↓']]){
     const move=action(`Move ${value.name} ${label} and reassign palette letters`,symbol,()=>moveQuick(value,offset),`quick-move-${label}-${identity}`);
     move.disabled=index+offset<0||index+offset>=values.length;row.append(move);
    }
   }
   else{
    const collected=contains('quick',value);
    const collect=action(`${collected?'Remove':'Collect'} ${value.name} ${collected?'from':'in'} this design's quick palette`,collected?'✓ Palette':'+ Palette',()=>toggle('quick',value),`${section}-collect-${identity}`);
    collect.className='color-action color-collect';
    collect.setAttribute('aria-pressed',String(collected));row.append(collect);
   }
   list.append(row);
  }
 }
 function render(){
  const focused=document.activeElement?.dataset.colorControl;
  const designColors=colors.fromBands(state.bands),list=$('design-colors');list.replaceChildren();
  $('design-color-count').textContent=designColors.length;$('clone-design-colors').disabled=!designColors.length;
  if(!designColors.length)list.append(make('p','color-empty','Add a thread to start. Your design colors will appear here to collect in Quick palette.'));
  for(const value of designColors){
   const button=action(`Collect ${value.name} in Quick palette — ${describe(value)}`,'',()=>revealQuick(value),`design-${colors.key(value)}`);
   button.className='design-color';button.append(swatch(value),make('span','',value.name));list.append(button);
  }
  $('clear-quick-colors').disabled=!collection('quick').length;
  $('quick-color-count').textContent=collection('quick').length;$('favorite-color-count').textContent=library.favorites.length;
  renderShelf('quick','quick-colors');renderShelf('favorites','favorite-colors');renderPatternPalette();
  window.dispatchEvent(new Event('colorschange'));
  if(focused){
   const control=[...document.querySelectorAll('[data-color-control]')].find(el=>el.dataset.colorControl===focused);
   (control||$($('quick-colors-panel').hidden?'favorite-colors-tab':'quick-colors-tab')).focus({preventScroll:true});
  }
 }
 $('clear-quick-colors').onclick=()=>{
  if(!collection('quick').length)return;
  change(()=>{state.quickColors=[];});
  notify('Quick palette cleared. Bands and favorites kept. Undo to restore the palette.');
 };
 $('clone-design-colors').onclick=()=>{
  const threads=colors.fromBands(state.bands),before=collection('quick').length;
  const combined=colors.unique([...collection('quick'),...threads]);
  if(combined.length!==before)change(()=>{state.quickColors=orderedPalette(combined);});
  selectTab('quick');
  const omitted=threads.some(value=>!contains('quick',value));
  notify(omitted?`Palette limit reached (${colors.limit} colors). Remove colors to collect more.`:`${combined.length-before} new colors collected · click any swatch to reuse it`);
 };
 const patternsKey='rodloom-named-patterns-v1';
 let namedPatterns=[],patternsAvailable=true,editingPatternName=null;
 function loadNamedPatterns(){
  try{namedPatterns=colors.decodePatterns(localStorage.getItem(patternsKey));patternsAvailable=true;}
  catch{patternsAvailable=false;$('pattern-save-status').textContent='Saved patterns are unavailable. Check browser storage before saving.';}
 }
 function renderNamedPatterns(){
  const list=$('named-patterns');list.replaceChildren();
  if(!namedPatterns.length)list.append(make('li','color-empty','No saved patterns. Create a new pattern to start.'));
  for(const pattern of namedPatterns.slice().sort((a,b)=>a.name.localeCompare(b.name))){
   const row=make('li','saved-pattern'),label=make('div','saved-pattern-label');
   const sequence=make('small','',pattern.text.replace(/\s*\n\s*/g,', '));sequence.title=pattern.text;
   label.append(make('strong','',pattern.name),sequence);
   const edit=action(`Edit ${pattern.name}`,'✎',()=>editPattern(pattern),`pattern-edit-${pattern.name}`);
   const build=action(`Build ${pattern.name} — append sequence to design`,'▶',()=>{
    $('pattern-save-status').textContent='';
    try{buildPattern(pattern.text,false);$('pattern-save-status').textContent=`Pattern “${pattern.name}” added to design.`;}
    catch(error){$('pattern-save-status').textContent=error.message;}
   },`pattern-build-${pattern.name}`);
   const replace=action(`Replace existing bands with ${pattern.name}`,'⇄',()=>{
    $('pattern-save-status').textContent='';
    try{buildPattern(pattern.text,true);$('pattern-save-status').textContent=`Existing bands replaced with pattern “${pattern.name}”.`;}
    catch(error){$('pattern-save-status').textContent=error.message;}
   },`pattern-replace-${pattern.name}`);
   const remove=action(`Delete ${pattern.name}`,'×',()=>deletePattern(pattern),`pattern-delete-${pattern.name}`);
   row.append(label,edit,build,replace,remove);list.append(row);
  }
 }
 async function deletePattern(pattern){
  if(!await confirmAction(`Delete “${pattern.name}” from saved patterns? This cannot be undone.`,'Delete saved pattern','Delete'))return;
  $('pattern-save-status').textContent='';
  try{
   loadNamedPatterns();
   if(!patternsAvailable)throw Error('Saved patterns are unavailable. Check browser storage before deleting.');
   const next=namedPatterns.filter(item=>item.name!==pattern.name);
   localStorage.setItem(patternsKey,JSON.stringify({version:1,patterns:next}));
   namedPatterns=next;renderNamedPatterns();$('new-pattern').focus();
   $('pattern-save-status').textContent=`Pattern “${pattern.name}” deleted.`;
  }catch(error){$('pattern-save-status').textContent=error.message;}
 }
 function openPatternEditor(){
  $('pattern-title').textContent=editingPatternName?'Edit pattern':'Create new pattern';
  renderPatternPalette();$('pattern-dialog').showModal();$('pattern-text').focus();
 }
 $('pattern-cancel').onclick=()=>{$('pattern-dialog').close();};
 $('new-pattern').onclick=()=>{
  editingPatternName=null;
  $('pattern-text').value='';$('pattern-save-name').value='';
  $('pattern-error').textContent='';$('pattern-save-status').textContent='';askToSavePattern();openPatternEditor();
 };
 function askToSavePattern(){
  $('pattern-save-prompt').hidden=false;
 }
 function editPattern(pattern){
  editingPatternName=pattern.name;
  $('pattern-text').value=pattern.text;$('pattern-save-name').value=pattern.name;
  $('pattern-error').textContent='';$('pattern-save-status').textContent='';askToSavePattern();openPatternEditor();
 }
 function saveNamedPattern(){
  $('pattern-error').textContent='';$('pattern-save-status').textContent='';
  try{
   loadNamedPatterns();
   if(!patternsAvailable)throw Error('Saved patterns are unavailable. Check browser storage before saving.');
   const name=$('pattern-save-name').value.trim(),text=$('pattern-text').value.trim();
   if(!name||name.length>80)throw Error('Enter a pattern name (up to 80 characters).');
   if(text.length>10000)throw Error('Pattern text is too long.');
   colors.parsePatternDefinition(text);
   const existing=namedPatterns.find(pattern=>pattern.name.toLowerCase()===name.toLowerCase());
   if(existing&&existing.name!==editingPatternName&&existing.text!==text)throw Error('That pattern name is already saved. Choose a different name.');
   if(existing&&editingPatternName&&existing.name!==editingPatternName)throw Error('That pattern name is already saved. Choose a different name.');
   const remaining=namedPatterns.filter(pattern=>pattern.name!==editingPatternName);
   if(!existing&&remaining.length>=100)throw Error('Maximum 100 named patterns saved.');
   const next=existing&&!editingPatternName?namedPatterns:[...remaining,{name,text}];
   localStorage.setItem(patternsKey,JSON.stringify({version:1,patterns:next}));
   namedPatterns=next;renderNamedPatterns();askToSavePattern();
   $('pattern-save-status').textContent=`Pattern “${name}” saved in this browser.`;
   $('pattern-dialog').close();editingPatternName=null;
  }catch(error){$('pattern-error').textContent=error.message;$('pattern-save-status').textContent=error.message;}
 }
 $('save-named-pattern').onclick=event=>{event?.preventDefault();saveNamedPattern();};
 function renderPatternPalette(){
  const legend=$('pattern-palette');legend.replaceChildren();
  for(const value of collection('quick').slice().sort((a,b)=>a.paletteLetter.length-b.paletteLetter.length||a.paletteLetter.localeCompare(b.paletteLetter))){
   const entry=make('span','pattern-color');entry.append(swatch(value),make('span','',`${value.paletteLetter}: ${value.name}`));legend.append(entry);
  }
  if(!collection('quick').length)legend.append(make('p','hint','Add colors to your quick palette first.'));
 }
 function buildPattern(text,replace){
  const bands=colors.parsePattern(text,collection('quick'));
  change(()=>{state.bands=replace?bands:[...state.bands,...bands];selectedBands.clear();});
  $('pattern-error').textContent='';$('bands').closest('details').open=true;
  notify(`${bands.length} bands ${replace?'built':'added'} from pattern. Undo to restore the previous design.`);
 }
 $('pattern-form').onsubmit=event=>{
  event.preventDefault();
  saveNamedPattern();
 };
 $('pattern-text').oninput=()=>{$('pattern-error').textContent='';$('pattern-save-status').textContent='';askToSavePattern();};
 $('browse-colors').onclick=()=>{
  document.querySelector('.palette-lookup').open=true;
  $('color-search').focus();$('color-search').scrollIntoView({block:'nearest'});
 };
 for(const [index,[name,tabId]] of paletteTabs.entries()){
  const tab=$(tabId);tab.onclick=()=>selectTab(name);
  tab.onkeydown=event=>{
   if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?paletteTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+paletteTabs.length)%paletteTabs.length;
    selectTab(paletteTabs[next][0],true);
   }
  };
 }
 window.colorWorkspace={render,revealQuick,hasQuick:value=>contains('quick',value),isFavorite:value=>contains('favorites',value),toggleQuick:value=>toggle('quick',value),toggleFavorite:value=>toggle('favorites',value)};
 window.addEventListener('storage',event=>{if(event.key===storageKey||event.key===null){load();render();window.dispatchEvent(new Event('colorschange'));}});
 load();
 // Move the old shared palette into the current draft once; never share it with other designs.
 if(state.quickColors===undefined){
  const wasClean=typeof hasUnsavedChanges==='function'&&!hasUnsavedChanges();
  state.quickColors=library.quick;
  if(library.quick.length&&persist())save();
  if(wasClean)markClean();
 }
 render();
})();
