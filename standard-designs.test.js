'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync('standard-designs.js','utf8'),context);
const source=fs.readFileSync('app.js','utf8');
vm.runInContext(source.slice(source.indexOf('const isCatalogThread ='),source.indexOf('const standardDesigns='))+source.slice(source.indexOf('const validColor ='),source.indexOf("try {const saved=")),context);
const designs=JSON.parse(JSON.stringify(context.window.RODLOOM_STANDARD_DESIGNS));

test('all four built-in designs are valid, with Durado still the initial default',()=>{
 assert.deepEqual(designs.map(d=>d.name),['Durado','Aqua Shade','CalStar Grapfighter','Durado no line']);
 assert.deepEqual(designs.map(d=>d.bands.length),[17,7,13,13]);
 for(const design of designs)assert.doesNotThrow(()=>context.validate(design));
});

test('new patterns preserve texture, center turns, and spiral directions',()=>{
 const [,aqua,calstar,durado]=designs;
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
