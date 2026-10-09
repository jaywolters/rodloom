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
  return result;
 }
 const key=value=>JSON.stringify([value.brand,value.line||'',value.sku]);
 function unique(values){
  const result=new Map();
  for(const value of values){const color=thread(value);if(color)result.set(key(color),color);}
  return [...result.values()].slice(0,limit);
 }
 function fromBands(bands){return unique(bands.flatMap(b=>b.wrap==='spiral'?[b,b.secondary]:[b]));}
 function toBand(value){const color=thread(value);return color?{...color,turns:color.finish==='metallic'?5:10}:null;}
 function decode(raw){
  if(!raw)return {quick:[],favorites:[]};
  const data=JSON.parse(raw);
  if(!data||![1,2].includes(data.version)||!Array.isArray(data.favorites)||data.version===1&&!Array.isArray(data.quick))throw Error('Invalid color library');
  return {quick:data.version===1?unique(data.quick):[],favorites:unique(data.favorites)};
 }
 const api={limit,thread,key,unique,fromBands,toBand,decode};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ThreadColors=api;
})(typeof window==='undefined'?globalThis:window);

if(typeof window!=='undefined'&&typeof document!=='undefined')(() => {
 const colors=window.ThreadColors,storageKey='rodloom-colors-v1';
 let library={quick:[],favorites:[]};
 function storageWarning(message){$('color-storage-status').hidden=!message;$('color-storage-status').textContent=message;}
 function load(){
  try{library=colors.decode(localStorage.getItem(storageKey));storageWarning('');}
  catch{storageWarning('Saved colors unavailable. Colors collected now will stay in this session until browser storage is available.');}
 }
 const collection=section=>section==='quick'?(state.quickColors||[]):library.favorites;
 const contains=(section,value)=>collection(section).some(item=>colors.key(item)===colors.key(value));
 function save(){
  try{localStorage.setItem(storageKey,JSON.stringify({version:2,favorites:library.favorites}));storageWarning('');}
  catch{storageWarning('Colors are only saved for this session. Browser storage is unavailable or full.');}
  render();window.dispatchEvent(new Event('colorschange'));
 }
 function toggle(section,value){
  const color=colors.thread(value);if(!color)return;
  const current=collection(section);
  if(!contains(section,color)&&current.length>=colors.limit){notify(`Maximum ${colors.limit} saved colors. Remove a color first.`);return;}
  const next=contains(section,color)?current.filter(item=>colors.key(item)!==colors.key(color)):section==='quick'?[color,...current]:[...current,color];
  if(section==='quick'){
   change(()=>{state.quickColors=next;});
  }else{library.favorites=next;save();}
 }
 function selectTab(favorites,focus=false){
  for(const [name,selected] of [['quick',!favorites],['favorite',favorites]]){
   const tab=$(`${name}-colors-tab`);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
   $(`${name}-colors-panel`).hidden=!selected;if(selected&&focus)tab.focus();
  }
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
  const list=$(id);list.replaceChildren();
  if(!collection(section).length){list.append(make('p','color-empty',section==='quick'?'Collect threads with + Palette in the catalog, or clone the colors from your design.':'No favorites yet. Star a color in your quick palette or the catalog.'));return;}
  for(const value of collection(section)){
   const identity=colors.key(value),row=make('div','saved-color');
   const choose=action(`Add ${value.name} — ${describe(value)}`,'',()=>add(value),`${section}-add-${identity}`);choose.className='saved-color-choice';
   const label=make('span','saved-color-label');label.append(make('strong','',value.name),make('small','',describe(value)));
   choose.append(swatch(value),label);row.append(choose);
   const favorite=contains('favorites',value);
   const star=action(`${favorite?'Unfavorite':'Favorite'} ${value.name}`,favorite?'★':'☆',()=>toggle('favorites',value),`${section}-star-${identity}`);
   star.setAttribute('aria-pressed',String(favorite));row.append(star);
   if(section==='quick'){
    const replace=action(`Replace selected bands with ${value.name}`,'⇄',()=>replaceSelectedBands(value),`${section}-replace-${identity}`);
    replace.className='color-action color-replace';row.append(replace);
    row.append(action(`Remove ${value.name} from this design's quick palette`,'×',()=>toggle('quick',value),`${section}-remove-${identity}`));
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
  if(!designColors.length)list.append(make('p','color-empty','Add a thread to start. Your design colors will appear here for one-click reuse.'));
  for(const value of designColors){
   const button=action(`Reuse ${value.name} — ${describe(value)}`,'',()=>add(value),`design-${colors.key(value)}`);
   button.className='design-color';button.append(swatch(value),make('span','',value.name));list.append(button);
  }
  $('quick-color-count').textContent=collection('quick').length;$('favorite-color-count').textContent=library.favorites.length;
  renderShelf('quick','quick-colors');renderShelf('favorites','favorite-colors');
  window.dispatchEvent(new Event('colorschange'));
  if(focused){
   const control=[...document.querySelectorAll('[data-color-control]')].find(el=>el.dataset.colorControl===focused);
   (control||$($('quick-colors-panel').hidden?'favorite-colors-tab':'quick-colors-tab')).focus({preventScroll:true});
  }
 }
 $('clone-design-colors').onclick=()=>{
  const threads=colors.fromBands(state.bands),before=collection('quick').length;
  const combined=colors.unique([...collection('quick'),...threads]);
  if(combined.length!==before)change(()=>{state.quickColors=combined;});
  selectTab(false);
  const omitted=threads.some(value=>!contains('quick',value));
  notify(omitted?`Palette limit reached (${colors.limit} colors). Remove colors to collect more.`:`${combined.length-before} new colors collected · click any swatch to reuse it`);
 };
 $('browse-colors').onclick=()=>{
  document.querySelector('.palette-lookup').open=true;
  $('color-search').focus();$('color-search').scrollIntoView({block:'nearest'});
 };
 for(const [name,favorites] of [['quick',false],['favorite',true]]){
  const tab=$(`${name}-colors-tab`);tab.onclick=()=>selectTab(favorites);
  tab.onkeydown=event=>{
   if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();selectTab(event.key==='Home'?false:event.key==='End'?true:!favorites,true);
   }
  };
 }
 window.colorWorkspace={render,hasQuick:value=>contains('quick',value),isFavorite:value=>contains('favorites',value),toggleQuick:value=>toggle('quick',value),toggleFavorite:value=>toggle('favorites',value)};
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
