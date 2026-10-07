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

test('built-in library uses Dorado as the default design',()=>{
 assert.deepEqual(designs.map(d=>d.name),['Dorado','Aqua Shade','Calstar Grafighter','Zarape']);
 assert.deepEqual(designs.map(d=>d.bands.length),[13,7,13,82]);
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
 const panels=design.bands.filter((b,i)=>b.sku==='RNS-D-361'&&design.bands[i-1]?.sku==='RNS-D-552');
 assert.equal(panels.length,2);
 assert.equal(panels[0].turns,panels[1].turns);
 for(const panel of panels){
  const i=design.bands.indexOf(panel);
  assert.deepEqual(design.bands.slice(i-2,i+3).map(b=>b.sku),[
   'NPD00-002','RNS-D-552','RNS-D-361','RNS-D-552','NPD00-002'
  ]);
  assert.ok(panel.turns>=15*design.bands[i-1].turns);
 }
});

test('Zarape combines adjacent identical solids without altering total turns',()=>{
 const design=designs.find(d=>d.name==='Zarape');
 for(let i=1;i<design.bands.length;i++){
  const previous=design.bands[i-1],band=design.bands[i];
  if(!previous.wrap&&!band.wrap)assert.notEqual(previous.sku,band.sku);
 }
 const dark=design.bands[1];
 assert.equal(dark.sku,'RNS-D-862');
 assert.equal(dark.turns,28);
 assert.equal(wrapSummary(design.bands,design.coverage,design.diameter).length,250);
});

test('Zarape has seven balanced fades with short paired-thread transitions',()=>{
 const design=designs.find(d=>d.name==='Zarape');
 const spirals=design.bands.filter(b=>b.wrap==='spiral');
 assert.equal(spirals.length,28);
 for(let i=0;i<spirals.length;i+=4){
  const [entry,centerIn,centerOut,exit]=spirals.slice(i,i+4);
  assert.ok(centerIn.turns>entry.turns);
  assert.ok(centerOut.turns>exit.turns);
  assert.ok(Math.abs(entry.turns-exit.turns)<=1);
  assert.ok(Math.abs(centerIn.turns-centerOut.turns)<=1);
  for(const band of [entry,centerIn,centerOut,exit]){
   assert.equal(band.sku,entry.sku);
   assert.equal(band.secondary.sku,entry.secondary.sku);
   assert.notEqual(band.sku,band.secondary.sku);
  }
  const start=design.bands.indexOf(entry)-1;
  const fade=design.bands.slice(start,start+10);
  assert.ok(fade[0].turns>fade[2].turns&&fade[2].turns>fade[4].turns);
  assert.ok(fade[5].turns<fade[7].turns&&fade[7].turns<fade[9].turns);
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
