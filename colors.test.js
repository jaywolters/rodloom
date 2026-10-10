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
 assert.equal(controls().length,5);
 assert.equal(controls()[0].className,'saved-color-choice');
 context.selectedBands.add(context.state.bands[0]);
 let replacement;
 context.replaceSelectedBands=value=>{replacement=value;};
 api.render();
 assert.equal(controls().length,6);
 assert.equal(controls()[0].className,'color-action color-replace');
 assert.equal(controls()[1].className,'saved-color-choice');
 controls()[0].onclick();
 assert.equal(replacement.sku,red.sku);
 context.selectedBands.clear();api.render();
 assert.equal(controls().length,5);
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

test('palette additions and removals reassign letters in shelf order and persist',()=>{
 const {$,api,context,storage}=workspace();
 const beforeBands=JSON.stringify(context.state.bands);
 api.toggleQuick(red);api.toggleQuick(gold);
 assert.deepEqual(Array.from(context.state.quickColors,c=>[c.sku,c.paletteLetter]),[[gold.sku,'A'],[red.sku,'B']]);
 api.toggleQuick(gold);
 assert.equal(context.state.quickColors[0].paletteLetter,'A');
 assert.equal(context.state.quickColors[0].sku,red.sku);
 api.toggleQuick(gold);api.toggleQuick(red);
 assert.equal(context.state.quickColors[0].paletteLetter,'A');
 const draft=JSON.parse(storage.get('threadwrap-design'));
 const reloaded=workspace(null,false,draft);
 assert.equal(reloaded.context.state.quickColors[0].paletteLetter,'A');
 assert.equal($('pattern-palette').children[0].children[1].textContent,'A: Gold');
 assert.equal(colors.parsePattern('1A',context.state.quickColors)[0].sku,gold.sku);
 assert.equal(JSON.stringify(context.state.bands),beforeBands);
 assert.equal(colors.letter(25),'Z');assert.equal(colors.letter(26),'AA');
});

test('revealing and cloning colors also assign contiguous shelf-order letters',()=>{
 const {api,context,$}=workspace(null,false,{quickColors:[{...gold,paletteLetter:'Z'}]});
 api.revealQuick(red);
 assert.deepEqual(Array.from(context.state.quickColors,c=>[c.sku,c.paletteLetter]),[[red.sku,'A'],[gold.sku,'B']]);
 context.state.quickColors=[{...red,paletteLetter:'Z'}];
 $('clone-design-colors').onclick();
 assert.deepEqual(Array.from(context.state.quickColors,c=>c.paletteLetter),['A','B']);
});

test('palette additions and removals reassign letters beyond Z',()=>{
 const quickColors=Array.from({length:28},(_,i)=>({...red,sku:`thread-${i}`,paletteLetter:colors.letter(i)}));
 const {api,context,$}=workspace(null,false,{quickColors});
 api.toggleQuick(gold);
 assert.deepEqual(Array.from(context.state.quickColors,c=>c.paletteLetter),Array.from({length:29},(_,i)=>colors.letter(i)));
 api.toggleQuick(quickColors[3]);
 assert.deepEqual(Array.from(context.state.quickColors,c=>c.paletteLetter),Array.from({length:28},(_,i)=>colors.letter(i)));
 assert.equal($('pattern-palette').children[26].children[1].textContent,'AA: Red');
});

test('quick palette moves reassign letters by shelf order, persist, and leave bands and favorites unchanged',()=>{
 const {$,api,context,storage}=workspace(JSON.stringify({version:2,favorites:[gold]}),false,{quickColors:[{...gold,paletteLetter:'B'},{...red,paletteLetter:'A'}]});
 const beforeBands=JSON.stringify(context.state.bands),beforePalette=JSON.parse(JSON.stringify(context.state.quickColors));
 const move=(row,direction)=>$('quick-colors').children[row].children.find(button=>button.dataset.colorControl?.startsWith(`quick-move-${direction}-`));
 assert.equal(move(0,'up').disabled,true);assert.equal(move(1,'down').disabled,true);
 move(0,'up').onclick();assert.deepEqual(JSON.parse(JSON.stringify(context.state.quickColors)),beforePalette);
 move(1,'up').onclick();
 assert.deepEqual(Array.from(context.state.quickColors,item=>[item.sku,item.paletteLetter]),[[red.sku,'A'],[gold.sku,'B']]);
 move(0,'down').onclick();
 assert.deepEqual(Array.from(context.state.quickColors,item=>[item.sku,item.paletteLetter]),[[gold.sku,'A'],[red.sku,'B']]);
 assert.equal(colors.parsePattern('1A',context.state.quickColors)[0].sku,gold.sku);
 assert.equal(JSON.stringify(context.state.bands),beforeBands);assert.ok(api.isFavorite(gold));
 const reloaded=workspace(null,false,JSON.parse(storage.get('threadwrap-design')));
 assert.deepEqual(Array.from(reloaded.context.state.quickColors,item=>[item.sku,item.paletteLetter]),[[gold.sku,'A'],[red.sku,'B']]);
 // Restoring the design snapshot also restores its original order and letter assignments.
 context.state.quickColors=beforePalette;api.render();
 assert.deepEqual(Array.from(context.state.quickColors,item=>item.paletteLetter),['B','A']);
});

test('reordering a large palette reassigns letters beyond Z and refreshes the pattern key',()=>{
 const quickColors=Array.from({length:28},(_,i)=>({...red,sku:`thread-${i}`,paletteLetter:colors.letter(27-i)}));
 const {$,context}=workspace(null,false,{quickColors});
 $('quick-colors').children[27].children.find(button=>button.dataset.colorControl?.startsWith('quick-move-up-')).onclick();
 assert.deepEqual(Array.from(context.state.quickColors,item=>item.paletteLetter),Array.from({length:28},(_,i)=>colors.letter(i)));
 assert.equal(context.state.quickColors[26].sku,'thread-27');
 assert.equal(colors.parsePattern('1AA',context.state.quickColors)[0].sku,'thread-27');
 assert.equal($('pattern-palette').children[26].children[1].textContent,'AA: Red');
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
 for(const text of ['', '0A','1001A','1.5A','12Z','4/AB','4/A','12A,','12A, nonsense']){
  assert.throws(()=>colors.parsePattern(text,palette),Error,text);
 }
});

test('patterns support more than 100 bands',()=>{
 const text=Array(250).fill('1A').join(',');
 assert.equal(colors.parsePatternDefinition(text).length,250);
 assert.equal(colors.parsePattern(text,colors.labelPalette([red],false)).length,250);
});

test('pattern editor submits only to save and never changes design bands',()=>{
 const {$,api,context,storage}=workspace();api.toggleQuick(red);api.toggleQuick(gold);
 $('type-pattern').onclick();$('new-pattern').onclick();
 const before=JSON.stringify(context.state.bands);
 $('pattern-text').value='12A, 4/AB';$('pattern-save-name').value='Sequence';
 $('pattern-form').onsubmit({preventDefault(){}});
 assert.equal(JSON.stringify(context.state.bands),before);
 assert.equal(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns[0].name,'Sequence');
 $('new-pattern').onclick();
 $('pattern-text').value='0Z';$('pattern-save-name').value='Invalid';
 $('pattern-form').onsubmit({preventDefault(){}});
 assert.equal(JSON.stringify(context.state.bands),before);
 assert.equal($('pattern-dialog').open,true);
 assert.match($('pattern-error').textContent,/turns must be/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(!html.includes('id="pattern-replace"'));
 assert.ok(!html.includes('>Build bands</button>'));
 assert.match(html,/id="save-named-pattern" type="submit"[^>]*>Save<\/button>/);
});

test('patterns can be saved and edited without any palette colors but require colors to build',()=>{
 const {$,context,storage}=workspace();
 context.state.quickColors=[];
 const before=JSON.stringify(context.state.bands);
 const text='12A, 1B, 1C, 1B, 11A, 1B, 2C, 1B, 10A, 1B, 3C, 1B, 9A, 1B, 4C, 1B';
 $('type-pattern').onclick();$('new-pattern').onclick();
 $('pattern-text').value=text;$('pattern-save-name').value='Fade';
 $('pattern-form').onsubmit({preventDefault(){}});
 assert.deepEqual(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns,[{name:'Fade',text}]);
 assert.equal($('pattern-dialog').open,false);
 assert.equal(JSON.stringify(context.state.bands),before);
 $('named-patterns').children[0].children[2].onclick();
 assert.match($('pattern-save-status').textContent,/color A is not in the quick palette/);
 assert.equal(JSON.stringify(context.state.bands),before);
 $('named-patterns').children[0].children[1].onclick();
 $('pattern-text').value='4/AA+B, 3\\BC';$('save-named-pattern').onclick();
 assert.equal($('pattern-dialog').open,false);
 assert.equal(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns[0].text,'4/AA+B, 3\\BC');
 assert.equal(JSON.stringify(context.state.bands),before);
});

test('pattern syntax validation is independent of catalog colors',()=>{
 assert.deepEqual(colors.parsePatternDefinition('12A, 4/AB, 3\\AA+B'),[
  {turns:12,direction:'',letters:['A']},
  {turns:4,direction:'/',letters:['A','B']},
  {turns:3,direction:'\\',letters:['AA','B']}
 ]);
 for(const text of ['', '0A', '1001A', 'A12', '4/A', '12A,']){
  assert.throws(()=>colors.parsePatternDefinition(text),Error,text);
 }
});

test('named patterns show save fields, persist, and load inline without building bands',()=>{
 const {$,api,storage,context}=workspace();api.toggleQuick(red);
 $('type-pattern').onclick();assert.equal($('pattern-save-prompt').hidden,false);
 $('pattern-text').value='12A';$('pattern-text').oninput();
 assert.equal($('pattern-save-prompt').hidden,false);
 $('pattern-save-name').value='Simple';$('save-named-pattern').onclick();
 assert.equal($('pattern-save-prompt').hidden,false);
 assert.match($('pattern-save-status').textContent,/saved in this browser/);
 assert.deepEqual(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns,[{name:'Simple',text:'12A'}]);
 $('pattern-text').value='2A';$('pattern-text').oninput();
 $('save-named-pattern').onclick();assert.match($('pattern-save-status').textContent,/different name/);
 $('pattern-text').value='';$('type-pattern').onclick();
 assert.equal($('named-patterns').children[0].children[0].children[0].textContent,'Simple');
 $('named-patterns').children[0].children[1].onclick();
 assert.equal($('pattern-text').value,'12A');assert.equal(context.state.bands.length,2);
 assert.equal($('pattern-dialog').open,true);assert.notEqual($('pattern-list-view').hidden,true);
 $('pattern-text').value='3A';$('pattern-form').onsubmit({preventDefault(){}});
 assert.equal($('pattern-dialog').open,false);
 assert.deepEqual(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns,[{name:'Simple',text:'3A'}]);
 $('new-pattern').onclick();assert.equal($('pattern-text').value,'');assert.equal($('pattern-save-name').value,'');
 assert.equal($('pattern-dialog').open,true);assert.equal(context.state.bands.length,2);
 $('pattern-cancel').onclick();assert.equal($('pattern-dialog').open,false);
});

test('pattern list sorts saved names and the tab replaces the old modal and toolbar button',()=>{
 const {$,storage}=workspace();
 storage.set('rodloom-named-patterns-v1',JSON.stringify({version:1,patterns:[{name:'Zebra',text:'2A'},{name:'Amber',text:'1A'}]}));
 $('type-pattern').onclick();
 assert.deepEqual($('named-patterns').children.map(row=>row.children[0].children[0].textContent),['Amber','Zebra']);
 const html=fs.readFileSync('index.html','utf8');
 assert.equal((html.match(/id="type-pattern"/g)||[]).length,1);
 assert.match(html,/<button id="type-pattern"[^>]*role="tab"[^>]*aria-controls="patterns-panel"/);
 assert.match(html,/<div id="patterns-panel"[^>]*role="tabpanel"/);
 assert.match(html,/<dialog id="pattern-dialog" aria-labelledby="pattern-title">/);
 assert.ok(!html.includes('id="list-patterns"'));
 assert.match(html,/id="new-pattern"[^>]*title="Create new pattern"[^>]*>＋<\/button>/);
});

test('saved pattern rows build sequences directly without opening the editor',()=>{
 const {$,context,storage,messages}=workspace(null,false,{quickColors:[red,gold]});
 storage.set('rodloom-named-patterns-v1',JSON.stringify({version:1,patterns:[{name:'Paired',text:'12A, 4/AB'}]}));
 $('type-pattern').onclick();
 const row=$('named-patterns').children[0];
 assert.equal(row.tag,'li');
 assert.equal(row.children[0].children[1].textContent,'12A, 4/AB');
 assert.equal(row.children[1].attributes['aria-label'],'Edit Paired');
 row.children[2].onclick();
 assert.equal(context.state.bands.length,4);
 assert.equal(context.state.bands[2].turns,12);
 assert.equal(context.state.bands[3].wrap,'spiral');
 assert.equal($('pattern-list-view').hidden,undefined);
 assert.match($('pattern-save-status').textContent,/added to design/);
 assert.match(messages.at(-1),/Undo/);
 context.state.quickColors=[];
 const before=JSON.stringify(context.state.bands);
 row.children[2].onclick();
 assert.equal(JSON.stringify(context.state.bands),before);
 assert.match($('pattern-save-status').textContent,/not in the quick palette/);
 context.state.quickColors=[red,gold];context.state.bands=Array(100).fill({...red,turns:1});
 row.children[2].onclick();
 assert.equal(context.state.bands.length,102);
 assert.match($('pattern-save-status').textContent,/added to design/);
 assert.equal(row.children[3].attributes['aria-label'],'Replace existing bands with Paired');
 row.children[3].onclick();
 assert.equal(context.state.bands.length,2);
 assert.equal(context.state.bands[0].turns,12);
 assert.equal(context.state.bands[1].wrap,'spiral');
 assert.match($('pattern-save-status').textContent,/Existing bands replaced/);
 context.state.quickColors=[];
 const replaced=JSON.stringify(context.state.bands);
 row.children[3].onclick();
 assert.equal(JSON.stringify(context.state.bands),replaced);
 assert.match($('pattern-save-status').textContent,/not in the quick palette/);
 assert.ok(!fs.readFileSync('index.html','utf8').includes('pattern-list-help'));
});

test('saved patterns can be deleted with confirmation without changing design bands',async()=>{
 const {$,context,storage}=workspace();
 storage.set('rodloom-named-patterns-v1',JSON.stringify({version:1,patterns:[{name:'Simple',text:'1A'}]}));
 $('type-pattern').onclick();
 const before=JSON.stringify(context.state.bands),remove=$('named-patterns').children[0].children[4];
 assert.equal(remove.attributes['aria-label'],'Delete Simple');
 context.confirmAction=async()=>false;
 await remove.onclick();
 assert.equal(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns.length,1);
 context.confirmAction=async()=>true;
 await remove.onclick();
 assert.deepEqual(JSON.parse(storage.get('rodloom-named-patterns-v1')).patterns,[]);
 assert.equal(JSON.stringify(context.state.bands),before);
 assert.match($('pattern-save-status').textContent,/deleted/);
 assert.match($('named-patterns').children[0].textContent,/No saved patterns/);
});

test('named pattern saving validates input and reports blocked storage without claiming success',()=>{
 const {$,api,storage}=workspace();api.toggleQuick(red);
 $('pattern-save-name').value='';$('pattern-text').value='12A';$('save-named-pattern').onclick();
 assert.match($('pattern-save-status').textContent,/Enter a pattern name/);
 $('pattern-save-name').value='Invalid';$('pattern-text').value='0Z';$('save-named-pattern').onclick();
 assert.match($('pattern-save-status').textContent,/turns must be/);
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
 $('quick-colors-tab').onkeydown({key:'End',preventDefault(){}});
 assert.equal($('type-pattern').attributes['aria-selected'],'true');assert.equal($('patterns-panel').hidden,false);
 assert.equal($('favorite-colors-panel').hidden,true);
 $('type-pattern').onkeydown({key:'ArrowRight',preventDefault(){}});
 assert.equal($('quick-colors-tab').attributes['aria-selected'],'true');assert.equal($('patterns-panel').hidden,true);
 storage.set('rodloom-colors-v1',JSON.stringify({version:1,quick:[gold],favorites:[red]}));
 listeners.storage({key:'rodloom-colors-v1'});
 assert.equal($('quick-color-count').textContent,1);
 assert.equal($('favorite-color-count').textContent,1);
 assert.ok(api.hasQuick(red));
 assert.ok(!api.hasQuick(gold));
});
