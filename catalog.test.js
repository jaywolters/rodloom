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
async function catalog(image=localImage){
 class Element{
  constructor(){this.children=[];this.style={};this.classList={add(){}};this.value='';}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(){}
  get options(){return this.children;}
 }
 const elements={},bands=[],requests=[];
 const $=id=>elements[id]??=new Element();
 $('thread-brand').value='Fuji';
 const context=vm.createContext({URL,window:{RODLOOM_API_BASE:'https://api.example'},$,Option:class extends Element{constructor(label,value){super();this.value=value;}},
  make:()=>new Element(),state:{bands},addBand:band=>bands.push(band),notify(){},
  fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({items:[{id:'1',image,brand:'Fuji',name:'Red',line:'Nylon',sku:'R',code:'R',finish:'regular',source:'https://mudhole.com/products/thread'}]})};}});
 vm.runInContext(fs.readFileSync('catalog.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 const button=$('color-results').children[0].children[0];
 return {button,image:button.children[0],bands,$,requests};
}

test('catalog and lazy images are loaded only from bundled assets',async()=>{
 const {image,button,requests}=await catalog();
 assert.deepEqual(requests,['assets/catalog.json']);
 assert.equal(image.src,localImage);
 assert.equal(image.loading,'lazy');
 assert.equal(image.decoding,'async');
 assert.notEqual(button.disabled,true);
});

test('image failures leave threads usable without any remote fallback',async()=>{
 const {image,button,bands}=await catalog();
 image.onerror();
 assert.equal(image.src,localImage);
 assert.equal(image.hidden,true);
 button.onclick();
 assert.equal(bands[0].color,'#808080');
 assert.equal(bands[0].name,'Red');
});

test('remote, missing, and traversal image paths are never requested',async()=>{
 for(const url of ['', 'https://cdn.shopify.com/image.jpg','//evil.example/image.jpg','assets/swatches/../../remote.jpg','/api/swatch?id=1']){
  const {image}=await catalog(url);
  assert.equal(image.src,undefined);
  assert.equal(image.hidden,true);
 }
});

test('threads can be added even before a lazy image loads',async()=>{
 const {button,bands}=await catalog();
 button.onclick();
 assert.equal(bands.length,1);
 assert.equal(bands[0].color,'#808080');
});
