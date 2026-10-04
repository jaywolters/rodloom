'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {wrapSummary}=require('./geometry.js');

const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync('standard-designs.js','utf8'),context);
const source=fs.readFileSync('app.js','utf8');
vm.runInContext(source.slice(source.indexOf('const isCatalogThread ='),source.indexOf('const standardDesigns='))+source.slice(source.indexOf('const validColor ='),source.indexOf("try {const saved=")),context);
const designs=JSON.parse(JSON.stringify(context.window.RODLOOM_STANDARD_DESIGNS));

test('built-in library keeps Durado no line as default and removes Durado',()=>{
 assert.deepEqual(designs.map(d=>d.name),['Durado no line','Aqua Shade','CalStar Grapfighter','Zarape']);
 assert.deepEqual(designs.map(d=>d.bands.length),[13,7,13,75]);
 for(const design of designs)assert.doesNotThrow(()=>context.validate(design));
});

test('Zarape uses only Fuji and ProWrap catalog threads and stays within the band limit',()=>{
 const design=designs.find(d=>d.name==='Zarape');
 assert.equal(design.texture,true);
 assert.ok(design.bands.length<=100);
 assert.equal(design.bands.reduce((sum,b)=>sum+b.turns*(b.wrap==='spiral'?2:1),0),1000);
 assert.equal(wrapSummary(design.bands,design.coverage,design.diameter).length,250);
 assert.equal(design.coverage,0.25);
 for(const band of design.bands.flatMap(b=>b.wrap==='spiral'?[b,b.secondary]:[b])){
  assert.ok(['Fuji','ProWrap'].includes(band.brand));
  assert.equal(band.catalog,true);
  assert.ok(band.sku);
  assert.match(band.source,/^https:\/\/mudhole\.com\/products\//);
 }
 assert.equal(design.bands[0].sku,'RNS-D-361');
 assert.equal(design.bands.at(-1).sku,'RNS-D-434');
 assert.equal(design.bands.filter(b=>b.sku==='RNS-D-361'&&b.turns===50).length,2);
});

test('Zarape has seven tapered paired-thread fades without changing its trim bands',()=>{
 const design=designs.find(d=>d.name==='Zarape');
 const spirals=design.bands.filter(b=>b.wrap==='spiral');
 assert.equal(spirals.length,21);
 for(let i=0;i<spirals.length;i+=3){
  const [entry,center,exit]=spirals.slice(i,i+3);
  assert.ok(center.turns>entry.turns);
  assert.ok(center.turns>exit.turns);
  assert.equal(entry.sku,center.sku);
  assert.equal(exit.secondary.sku,center.secondary.sku);
  assert.notEqual(center.sku,center.secondary.sku);
 }
 assert.equal(wrapSummary(design.bands,design.coverage,design.diameter).length,250);
});

test('new patterns preserve texture, center turns, and spiral directions',()=>{
 const [durado,aqua,calstar]=designs;
 assert.equal(aqua.texture,true);
 assert.equal(calstar.texture,true);
 assert.equal(durado.texture,false);
 assert.equal(aqua.bands[1].turns,150);
 assert.equal(calstar.bands[6].turns,3);
 assert.equal(calstar.bands[6].secondary.sku,'NPD00-017');
 assert.equal(durado.bands[6].turns,220);
 for(const design of [calstar,durado]){
  const spirals=design.bands.filter(b=>b.wrap==='spiral');
  assert.equal(spirals[0].direction,1);
  assert.equal(spirals.at(-1).direction,-1);
 }
});
