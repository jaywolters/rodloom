'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');

test('every bundled catalog entry has an intact local image',()=>{
 const snapshot=JSON.parse(fs.readFileSync('assets/catalog.json','utf8'));
 assert.ok(snapshot.items.length>0);
 assert.equal(new Set(snapshot.items.map(item=>`${item.brand}/${item.line}`)).size,6);
 for(const item of snapshot.items){
  assert.match(item.image,/^assets\/swatches\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/);
  const content=fs.readFileSync(item.image);
  assert.ok(content.length>0);
  assert.equal(createHash('sha256').update(content).digest('hex'),item.image.split('/').pop().split('.')[0]);
 }
});

const localImage='assets/swatches/'+'a'.repeat(64)+'.png';
async function catalog(image=localImage,preference=null,storageUnavailable=false){
 class Element{
  constructor(){this.children=[];this.style={};this.attributes={};this.dataset={};this.classList={add(){}};this.value='';}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attributes[name]=value;}
  get options(){return this.children;}
 }
 const elements={},bands=[],requests=[],quick=[],favorites=[],listeners={},storage=new Map();
 if(preference!==null)storage.set('rodloom-catalog-auto-gray',preference);
 const toggle=(list,thread)=>{const index=list.findIndex(item=>item.sku===thread.sku);if(index<0)list.push(thread);else list.splice(index,1);listeners.colorschange();};
 const $=id=>elements[id]??=new Element();
 $('thread-brand').value='Fuji';
 const context=vm.createContext({URL,window:{RODLOOM_API_BASE:'https://api.example',addEventListener:(name,fn)=>listeners[name]=fn,
  colorWorkspace:{hasQuick:thread=>quick.some(item=>item.sku===thread.sku),isFavorite:thread=>favorites.some(item=>item.sku===thread.sku),toggleQuick:thread=>toggle(quick,thread),toggleFavorite:thread=>toggle(favorites,thread)}},$,Option:class extends Element{constructor(label,value){super();this.value=value;}},
  make:()=>new Element(),state:{bands},addBand:band=>bands.push(band),notify(){},
  localStorage:{getItem:key=>{if(storageUnavailable)throw Error('Blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(storageUnavailable)throw Error('Blocked');storage.set(key,value);}},
  fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({items:[{id:'1',image,brand:'Fuji',name:'Red',line:'Nylon',sku:'R',code:'R',finish:'regular',source:'https://mudhole.com/products/thread'}]})};}});
 vm.runInContext(fs.readFileSync('catalog.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 const button=$('color-results').children[0].children[0];
 return {button,image:button.children[0],bands,$,requests,quick,favorites,storage,actions:$('color-results').children[0].children[1].children};
}

test('auto gray is on by default and the feature button toggles and saves it',async()=>{
 const {$,storage}=await catalog();
 const button=$('catalog-auto-gray');
 assert.equal(button.attributes['aria-pressed'],'true');
 assert.equal($('thread-catalog').dataset.autoGray,'true');
 button.onclick();
 assert.equal(button.attributes['aria-pressed'],'false');
 assert.equal(button.textContent,'Auto gray: Off');
 assert.equal($('thread-catalog').dataset.autoGray,'false');
 assert.equal(storage.get('rodloom-catalog-auto-gray'),'false');
 button.onclick();
 assert.equal(storage.get('rodloom-catalog-auto-gray'),'true');
});

test('auto gray restores a saved preference and survives catalog filtering',async()=>{
 for(const preference of ['true','false',null,'invalid']){
  const {$}=await catalog(localImage,preference);
  $('color-search').oninput();
  assert.equal($('thread-catalog').dataset.autoGray,String(preference!=='false'));
  assert.equal($('catalog-auto-gray').attributes['aria-pressed'],String(preference!=='false'));
 }
});

test('auto gray toggle remains usable when browser storage is blocked',async()=>{
 const {$}=await catalog(localImage,null,true);
 $('catalog-auto-gray').onclick();
 assert.equal($('thread-catalog').dataset.autoGray,'false');
 $('catalog-auto-gray').onclick();
 assert.equal($('thread-catalog').dataset.autoGray,'true');
});

test('catalog and lazy images are loaded only from bundled assets',async()=>{
 const {image,button,requests}=await catalog();
 assert.deepEqual(requests,['assets/catalog.json']);
 assert.equal(image.src,localImage);
 assert.equal(image.loading,'lazy');
 assert.equal(image.decoding,'async');
 assert.notEqual(button.disabled,true);
});

test('image failures leave threads usable without any remote fallback',async()=>{
 const {image,button,bands,quick}=await catalog();
 image.onerror();
 assert.equal(image.src,localImage);
 assert.equal(image.hidden,true);
 button.onclick();
 assert.equal(bands.length,0);
 assert.equal(quick[0].color,'#808080');
 assert.equal(quick[0].name,'Red');
});

test('remote, missing, and traversal image paths are never requested',async()=>{
 for(const url of ['', 'https://cdn.shopify.com/image.jpg','//evil.example/image.jpg','assets/swatches/../../remote.jpg','/api/swatch?id=1']){
  const {image}=await catalog(url);
  assert.equal(image.src,undefined);
  assert.equal(image.hidden,true);
 }
});

test('swatch clicks collect threads before lazy images load without adding bands',async()=>{
 const {button,bands,quick,actions:[collect]}=await catalog();
 assert.match(button.attributes['aria-label'],/quick palette/);
 button.onclick();
 assert.equal(bands.length,0);
 assert.equal(quick.length,1);
 assert.equal(quick[0].color,'#808080');
 assert.equal(collect.attributes['aria-pressed'],'true');
 button.onclick();
 assert.equal(quick.length,1);
 collect.onclick();
 assert.equal(quick.length,0);
 button.onclick();
 assert.equal(quick.length,1);
});

test('catalog swatch collection is independent of the design band limit',async()=>{
 const {button,bands,quick}=await catalog();
 bands.push(...Array(100).fill({}));
 button.onclick();
 assert.equal(bands.length,100);
 assert.equal(quick.length,1);
});

test('catalog collects and favorites threads without changing the design',async()=>{
 const {actions:[collect,star],quick,favorites,bands}=await catalog();
 collect.onclick();star.onclick();
 assert.equal(bands.length,0);
 assert.equal(quick[0].sku,'R');
 assert.equal(favorites[0].brand,'Fuji');
 assert.equal(collect.attributes['aria-pressed'],'true');
 assert.equal(star.attributes['aria-pressed'],'true');
 collect.onclick();
 assert.equal(quick.length,0);
 assert.equal(favorites.length,1);
 assert.equal(collect.attributes['aria-pressed'],'false');
});
