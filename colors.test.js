'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const colors=require('./colors');
const red={catalog:true,brand:'Fuji',line:'Ultra Poly',sku:'F-R',code:'R',name:'Red',color:'#b82932',finish:'regular',source:'https://mudhole.com/products/thread'};
const gold={...red,brand:'ProWrap',sku:'P-G',name:'Gold',color:'#b89b43',finish:'metallic'};

test('cloning design colors collects both spiral strands, deduplicated by product',()=>{
 const result=colors.fromBands([{...red,turns:7},{...red,wrap:'spiral',secondary:gold,turns:5},{...gold,turns:3}]);
 assert.deepEqual(result,[red,gold]);
 assert.equal(result[0].turns,undefined);
 assert.equal(result[0].secondary,undefined);
 result[0].name='Independent';
 assert.equal(red.name,'Red');
});

test('same RGB does not merge distinct catalog threads',()=>{
 assert.equal(colors.unique([red,{...red,sku:'F-R-2'},{...red,brand:'ProWrap'},{...red,line:'NOCP'}]).length,4);
 assert.equal(colors.unique([red,{...red,color:'#ff0000'}]).length,1);
 assert.equal(colors.unique([red,{...red,color:'#ff0000'}])[0].color,'#ff0000');
});

test('reusing a color creates a solid band with default turns and catalog metadata',()=>{
 assert.deepEqual(colors.toBand({...red,turns:900,wrap:'spiral',secondary:gold,direction:-1}),{...red,turns:10});
 assert.equal(colors.toBand(gold).turns,5);
 assert.equal(colors.toBand({color:'#abcdef'}),null);
});

test('stored colors validate, remove invalid entries, and round-trip safely',()=>{
 const raw=JSON.stringify({version:1,quick:[red,red,{...red,catalog:false},null],favorites:[gold]});
 assert.deepEqual(colors.decode(raw),{quick:[red],favorites:[gold]});
 assert.deepEqual(colors.decode(null),{quick:[],favorites:[]});
 assert.deepEqual(colors.decode('{"version":2,"favorites":[]}'),{quick:[],favorites:[]});
 for(const raw of ['{','null','{}','{"version":3,"favorites":[]}'])assert.throws(()=>colors.decode(raw));
 assert.equal(colors.thread({...red,color:'red'}),null);
 assert.equal(colors.thread({...red,source:'javascript:alert(1)'}).source,undefined);
 assert.equal(colors.unique(Array.from({length:600},(_,i)=>({...red,sku:String(i)}))).length,colors.limit);
});

function workspace(stored=null,failStorage=false,draft={}){
 class Element{
  constructor(tag,cls,text){this.value='';this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.attributes={};this.dataset={};this.style={};}
  append(...children){this.children.push(...children);}
  prepend(...children){this.children.unshift(...children);}
  showModal(){this.open=true;}
  close(){this.open=false;}
  replaceChildren(){this.children=[];}
  setAttribute(name,value){this.attributes[name]=value;}
  focus(){document.activeElement=this;}
  scrollIntoView(options){this.scrolled=options;}
  closest(){return $('palette-details');}
 }
 const elements={},listeners={},messages=[],bands=[{...red,turns:20},{...red,wrap:'spiral',turns:5,secondary:gold}],storage=new Map();
 if(stored!==null)storage.set('rodloom-colors-v1',stored);
 const $=id=>elements[id]??=new Element();
 const document={activeElement:{dataset:{}},querySelector:()=>$('catalog'),querySelectorAll:()=>[]};
 const window={addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent:event=>listeners[event.type]?.(event)};
 const context=vm.createContext({window,document,$,selectedBands:new Set(),Event:class{constructor(type){this.type=type;}},state:{bands,...draft},
  make:(...args)=>new Element(...args),notify:message=>messages.push(message),addBand:band=>{bands.push(band);return true;},
  localStorage:{getItem:key=>{if(failStorage)throw Error('Blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(failStorage)throw Error('Full');storage.set(key,value);}}
 });
 context.persist=()=>{if(failStorage)return false;storage.set('threadwrap-design',JSON.stringify(context.state));return true;};
 context.change=fn=>{fn();context.persist();window.colorWorkspace?.render();};
 vm.runInContext(fs.readFileSync('colors.js','utf8'),context);
 return {$,bands,api:window.colorWorkspace,storage,listeners,context,messages};
}

test('Clear palette keeps design bands and shared favorites, and persists the empty palette',()=>{
 const {$,context,storage}=workspace(JSON.stringify({version:2,favorites:[gold]}),false,{quickColors:[red]});
 const before=JSON.stringify(context.state.bands);
 assert.equal($('clear-quick-colors').disabled,false);
 $('clear-quick-colors').onclick();
 assert.equal(context.state.quickColors.length,0);
 assert.equal(JSON.stringify(context.state.bands),before);
 assert.equal($('favorite-color-count').textContent,1);
 assert.equal($('clear-quick-colors').disabled,true);
 assert.equal(JSON.parse(storage.get('threadwrap-design')).quickColors.length,0);
});

test('quick palette clones design threads once and reuses colors without the catalog',()=>{
 const {$,bands,api,storage,context}=workspace();
 $('clone-design-colors').onclick();$('clone-design-colors').onclick();
 assert.equal(bands.length,2);
 assert.equal($('quick-color-count').textContent,2);
 assert.equal(context.state.quickColors.length,2);
 assert.equal(JSON.parse(storage.get('threadwrap-design')).quickColors.length,2);
 assert.ok(api.hasQuick(red));
 $('quick-colors').children[0].children[0].onclick();
 assert.equal(bands.length,3);
 assert.equal(bands[2].sku,red.sku);
 assert.equal(bands[2].turns,10);
 assert.equal(bands[2].wrap,undefined);
});

test('revealing a band color collects it, opens Quick palette, and highlights without adding a band',()=>{
 const {$,api,context,storage,bands}=workspace();
 $('favorite-colors-tab').onclick();
 api.revealQuick(gold);
 assert.equal(bands.length,2);
 assert.equal(context.state.quickColors.length,1);
 assert.equal(JSON.parse(storage.get('threadwrap-design')).quickColors[0].sku,gold.sku);
 assert.equal($('quick-colors-panel').hidden,false);
 assert.equal($('palette-details').open,true);
 const row=$('quick-colors').children[0];
 assert.equal(row.className,'saved-color quick-highlight');
 assert.equal(row.scrolled.block,'center');
 assert.equal(context.document.activeElement,row.children[0]);
 api.revealQuick(gold);
 assert.equal(context.state.quickColors.length,1);
 api.revealQuick(red);
 assert.equal(context.state.quickColors.length,2);
 assert.equal($('quick-colors').children[0].className,'saved-color quick-highlight');
 assert.equal($('quick-colors').children[1].className,'saved-color');
});

test('design color buttons collect and reveal threads without adding bands or duplicates',()=>{
 const {$,bands,context}=workspace();
 const before=JSON.stringify(bands);
 $('favorite-colors-tab').onclick();
 $('design-colors').children[0].onclick();
 assert.equal(JSON.stringify(bands),before);
 assert.equal(context.state.quickColors.length,1);
 assert.equal(context.state.quickColors[0].sku,red.sku);
 assert.equal($('quick-colors-panel').hidden,false);
 assert.equal($('quick-colors').children[0].className,'saved-color quick-highlight');
 $('design-colors').children[0].onclick();
 assert.equal(context.state.quickColors.length,1);
 assert.equal(JSON.stringify(bands),before);
 $('design-colors').children[1].onclick();
 assert.equal(context.state.quickColors.length,2);
 assert.equal(context.state.quickColors[0].sku,gold.sku);
 assert.equal(JSON.stringify(bands),before);
});

test('replace buttons only appear with selected bands and precede the color chip',()=>{
 const {$,api,context}=workspace();
 api.toggleQuick(red);
 const controls=()=>$('quick-colors').children[0].children;
 assert.equal(controls().length,3);
 assert.equal(controls()[0].className,'saved-color-choice');
 context.selectedBands.add(context.state.bands[0]);
 let replacement;
 context.replaceSelectedBands=value=>{replacement=value;};
 api.render();
 assert.equal(controls().length,4);
 assert.equal(controls()[0].className,'color-action color-replace');
 assert.equal(controls()[1].className,'saved-color-choice');
 controls()[0].onclick();
 assert.equal(replacement.sku,red.sku);
 context.selectedBands.clear();api.render();
 assert.equal(controls().length,3);
 assert.equal(controls()[0].className,'saved-color-choice');
});

test('new quick palette colors appear first and persist in that order',()=>{
 const {api,context,storage}=workspace();
 api.toggleQuick(red);api.toggleQuick(gold);
 assert.deepEqual(Array.from(context.state.quickColors,c=>c.sku),[gold.sku,red.sku]);
 assert.deepEqual(JSON.parse(storage.get('threadwrap-design')).quickColors.map(c=>c.sku),[gold.sku,red.sku]);
 api.toggleQuick(red);api.toggleQuick(red);
 assert.deepEqual(Array.from(context.state.quickColors,c=>c.sku),[red.sku,gold.sku]);
});

test('favorites persist independently of quick palette and active design',()=>{
 const {$,bands,api,storage}=workspace();
 api.toggleQuick(red);api.toggleFavorite(red);api.toggleQuick(red);
 bands.length=0;api.render();
 assert.equal($('design-color-count').textContent,0);
 assert.ok(api.isFavorite(red));
 assert.ok(!api.hasQuick(red));
 const restored=workspace(storage.get('rodloom-colors-v1'));
 assert.ok(restored.api.isFavorite(red));
 restored.$('favorite-colors').children[0].children[0].onclick();
 assert.equal(restored.bands.at(-1).sku,red.sku);
 restored.api.toggleFavorite(red);
 assert.equal(restored.$('favorite-color-count').textContent,0);
});

test('quick palette follows design replacement while favorites remain shared',()=>{
 const {api,context,$}=workspace();
 api.toggleQuick(red);api.toggleFavorite(gold);
 const previous=structuredClone(context.state);
 context.state={bands:[],quickColors:[]};api.render();
 assert.ok(!api.hasQuick(red));assert.ok(api.isFavorite(gold));
 const collect=$('favorite-colors').children[0].children[2];
 assert.equal(collect.className,'color-action color-collect');
 assert.equal(collect.textContent,'+ Palette');
 collect.onclick();
 assert.ok(api.hasQuick(gold));assert.equal(context.state.bands.length,0);
 assert.ok(api.isFavorite(gold));
 context.state=previous;api.render();
 assert.ok(api.hasQuick(red));assert.ok(!api.hasQuick(gold));
});

test('legacy shared palette migrates into the draft and not subsequent designs',()=>{
 const {api,storage,context}=workspace(JSON.stringify({version:1,quick:[red],favorites:[gold]}));
 assert.ok(api.hasQuick(red));assert.ok(api.isFavorite(gold));
 assert.equal(context.state.quickColors.length,1);
 assert.equal(JSON.parse(storage.get('rodloom-colors-v1')).version,2);
 const next=workspace(storage.get('rodloom-colors-v1'));
 assert.ok(!next.api.hasQuick(red));assert.ok(next.api.isFavorite(gold));
 const restored=workspace(storage.get('rodloom-colors-v1'),false,JSON.parse(storage.get('threadwrap-design')));
 assert.ok(restored.api.hasQuick(red));
});

test('color storage failure keeps colors usable with an explicit session-only warning',()=>{
 const {$,api}=workspace(null,true);
 api.toggleQuick(red);api.toggleFavorite(gold);
 assert.ok(api.hasQuick(red));assert.ok(api.isFavorite(gold));
 assert.equal($('color-storage-status').hidden,false);
 assert.match($('color-storage-status').textContent,/only saved for this session/);
});

test('malformed storage does not prevent collecting colors',()=>{
 const {$,api}=workspace('{broken');
 assert.equal($('color-storage-status').hidden,false);
 api.toggleQuick(red);
 assert.ok(api.hasQuick(red));
 assert.equal($('color-storage-status').hidden,false);
 api.toggleFavorite(red);
 assert.equal($('color-storage-status').hidden,true);
});

test('palette letters stay attached through additions, removal, and reload',()=>{
 const {api,context,storage}=workspace();
 api.toggleQuick(red);api.toggleQuick(gold);
 assert.deepEqual(Array.from(context.state.quickColors,c=>c.paletteLetter),['B','A']);
 api.toggleQuick(red);
 assert.equal(context.state.quickColors[0].paletteLetter,'B');
 const draft=JSON.parse(storage.get('threadwrap-design'));
 const reloaded=workspace(null,false,draft);
 assert.equal(reloaded.context.state.quickColors[0].paletteLetter,'B');
 assert.equal(colors.letter(25),'Z');assert.equal(colors.letter(26),'AA');
});

test('typed pattern builds the supplied sequence and both spiral directions',()=>{
 const palette=colors.labelPalette([red,gold,{...red,sku:'third'},{...red,sku:'fourth'}],false);
 const text='12A, 4/AB, 12B, 4/BC, 8C, 2D, 5C, 1D, 2B, 1D, 5C, 2D, 8C, 4/BC, 12B, 4/AB, 12A';
 const bands=colors.parsePattern(text,palette);
 assert.equal(bands.length,17);
 assert.deepEqual(bands.map(b=>b.turns),[12,4,12,4,8,2,5,1,2,1,5,2,8,4,12,4,12]);
 assert.equal(bands[1].sku,red.sku);assert.equal(bands[1].secondary.sku,gold.sku);
 assert.equal(bands[1].wrap,'spiral');assert.equal(bands[1].direction,1);
 assert.equal(colors.parsePattern('3\\ba\n2a',palette)[0].direction,-1);
 const extended=[{...red,paletteLetter:'AA'},{...gold,paletteLetter:'B'}];
 assert.equal(colors.parsePattern('4/AA+B',extended)[0].sku,red.sku);
 bands[1].secondary.name='Changed';assert.equal(palette[1].name,gold.name);
});

test('invalid pattern input is rejected before any bands are built',()=>{
 const palette=colors.labelPalette([red],false);
 for(const text of ['', '0A','1001A','1.5A','12Z','4/AB','4/A','12A,','12A, nonsense',Array(101).fill('1A').join(',')]){
  assert.throws(()=>colors.parsePattern(text,palette),Error,text);
 }
});

test('pattern modal appends or replaces atomically and reports errors without closing',()=>{
 const {$,api,context}=workspace();api.toggleQuick(red);api.toggleQuick(gold);
 $('type-pattern').onclick();assert.equal($('pattern-dialog').open,true);
 $('pattern-text').value='12A, 4/AB';
 $('pattern-form').onsubmit({preventDefault(){}});
 assert.equal(context.state.bands.length,4);assert.equal($('pattern-dialog').open,false);
 $('type-pattern').onclick();$('pattern-replace').checked=true;
 $('pattern-text').value='2B';$('pattern-form').onsubmit({preventDefault(){}});
 assert.equal(context.state.bands.length,1);assert.equal(context.state.bands[0].sku,gold.sku);
 $('type-pattern').onclick();$('pattern-text').value='1Z';
 $('pattern-form').onsubmit({preventDefault(){}});
 assert.equal(context.state.bands.length,1);assert.equal($('pattern-dialog').open,true);
 assert.match($('pattern-error').textContent,/color Z/);
 $('pattern-replace').checked=false;context.state.bands=Array(100).fill(context.state.bands[0]);
 $('pattern-text').value='1A';$('pattern-form').onsubmit({preventDefault(){}});
 assert.equal(context.state.bands.length,100);assert.match($('pattern-error').textContent,/100 bands/);
});

test('named patterns prompt after typing, persist, and load into the modal without building bands',()=>{
 const {$,api,storage,context}=workspace();api.toggleQuick(red);
 $('type-pattern').onclick();assert.equal($('pattern-save-prompt').hidden,true);
 $('pattern-text').value='12A';$('pattern-text').oninput();
 assert.equal($('pattern-save-prompt').hidden,false);
 $('pattern-save-name').value='Simple';$('save-named-pattern').onclick();
 assert.equal($('pattern-save-prompt').hidden,true);
 assert.match($('pattern-save-status').textContent,/saved in this browser/);
 assert.deepEqual(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns,[{name:'Simple',text:'12A'}]);
 $('pattern-text').value='2A';$('pattern-text').oninput();
 $('save-named-pattern').onclick();assert.match($('pattern-save-status').textContent,/different name/);
 $('pattern-text').value='';$('type-pattern').onclick();
 assert.equal($('named-patterns').children[1].textContent,'Simple');
 $('named-patterns').value='Simple';$('named-patterns').onchange();
 assert.equal($('pattern-text').value,'12A');assert.equal(context.state.bands.length,2);
});

test('named pattern saving validates input and reports blocked storage without claiming success',()=>{
 const {$,api,storage}=workspace();api.toggleQuick(red);
 $('pattern-save-name').value='';$('pattern-text').value='12A';$('save-named-pattern').onclick();
 assert.match($('pattern-save-status').textContent,/Enter a pattern name/);
 $('pattern-save-name').value='Invalid';$('pattern-text').value='1Z';$('save-named-pattern').onclick();
 assert.match($('pattern-save-status').textContent,/color Z/);
 assert.equal(storage.has('rodloom-named-patterns-v1'),false);
 const blocked=workspace(null,true);blocked.api.toggleQuick(red);
 blocked.$('pattern-text').value='1A';blocked.$('pattern-save-name').value='Blocked';
 blocked.$('save-named-pattern').onclick();assert.match(blocked.$('pattern-save-status').textContent,/unavailable/);
 assert.throws(()=>colors.decodePatterns('{bad'),SyntaxError);
 assert.throws(()=>colors.decodePatterns(JSON.stringify({version:1,patterns:[{name:'',text:'1A'}]})),Error);
 assert.deepEqual(colors.decodePatterns(null),[]);
});

test('tabs support arrows, Home and End, and storage changes only refresh favorites',()=>{
 const {$,listeners,storage,api}=workspace();
 api.toggleQuick(red);
 $('quick-colors-tab').onkeydown({key:'ArrowRight',preventDefault(){}});
 assert.equal($('favorite-colors-tab').attributes['aria-selected'],'true');
 assert.equal($('quick-colors-panel').hidden,true);
 $('favorite-colors-tab').onkeydown({key:'Home',preventDefault(){}});
 assert.equal($('quick-colors-tab').tabIndex,0);
 storage.set('rodloom-colors-v1',JSON.stringify({version:1,quick:[gold],favorites:[red]}));
 listeners.storage({key:'rodloom-colors-v1'});
 assert.equal($('quick-color-count').textContent,1);
 assert.equal($('favorite-color-count').textContent,1);
 assert.ok(api.hasQuick(red));
 assert.ok(!api.hasQuick(gold));
});
