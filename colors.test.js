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
  constructor(tag,cls,text){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.attributes={};this.dataset={};this.style={};}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
  setAttribute(name,value){this.attributes[name]=value;}
  focus(){document.activeElement=this;}
  scrollIntoView(){}
 }
 const elements={},listeners={},messages=[],bands=[{...red,turns:20},{...red,wrap:'spiral',turns:5,secondary:gold}],storage=new Map();
 if(stored!==null)storage.set('rodloom-colors-v1',stored);
 const $=id=>elements[id]??=new Element();
 const document={activeElement:{dataset:{}},querySelector:()=>$('catalog'),querySelectorAll:()=>[]};
 const window={addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent:event=>listeners[event.type]?.(event)};
 const context=vm.createContext({window,document,$,Event:class{constructor(type){this.type=type;}},state:{bands,...draft},
  make:(...args)=>new Element(...args),notify:message=>messages.push(message),addBand:band=>{bands.push(band);return true;},
  localStorage:{getItem:key=>{if(failStorage)throw Error('Blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(failStorage)throw Error('Full');storage.set(key,value);}}
 });
 context.persist=()=>{if(failStorage)return false;storage.set('threadwrap-design',JSON.stringify(context.state));return true;};
 context.change=fn=>{fn();context.persist();window.colorWorkspace?.render();};
 vm.runInContext(fs.readFileSync('colors.js','utf8'),context);
 return {$,bands,api:window.colorWorkspace,storage,listeners,context,messages};
}

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
