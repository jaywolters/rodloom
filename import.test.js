'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup({stored=[],accept=true,replace=true,blocked=false,text}={}){
 const elements={},messages=[],prompts=[],history=[];
 const $=id=>elements[id]??={};
 const context=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync('standard-designs.js','utf8'),context);
 vm.runInContext(source.slice(source.indexOf('const isCatalogThread ='),source.indexOf('const standardDesigns='))+source.slice(source.indexOf('const validColor ='),source.indexOf('try {const saved=')),context);
 const design=structuredClone(context.validate(context.window.RODLOOM_STANDARD_DESIGNS[0]));
 design.quickColors=[];
 Object.assign(context,{$,state:{name:'Current',bands:[]},libraryKey:'threadwrap-designs',
  canReplaceDesign:async()=>replace,confirmAction:async message=>{prompts.push(message);return accept;},
  readLibrary:()=>structuredClone(stored),localStorage:{setItem(key,value){if(blocked)throw Error('Storage blocked');stored=JSON.parse(value);}},
  change:fn=>{history.push(structuredClone(context.state));fn();},
  markClean:()=>{context.cleaned=true;},renderLibrary:()=>{context.libraryRendered=true;},notify:message=>messages.push(message)});
 $('file').files=[{size:100,text:async()=>text??JSON.stringify(design)}];$('file').value='design.json';
 vm.runInContext(source.slice(source.indexOf("$('import').onclick="),source.indexOf("document.querySelector('.starting-points')")),context);
 return {context,$,design,messages,prompts,history,stored:()=>stored};
}
test('import saves the validated design and refreshes the library',async()=>{
 const s=setup();await s.$('file').onchange();
 assert.equal(s.stored().length,1);
 assert.equal(s.stored()[0].name,s.design.name);
 assert.equal(JSON.stringify(s.context.state),JSON.stringify(s.stored()[0]));
 assert.equal(s.context.libraryRendered,true);assert.equal(s.context.cleaned,true);
 assert.equal(s.history.length,1);assert.equal(s.$('file').value,'');
});
test('import accepts designs with more than 100 bands',async()=>{
 const s=setup();
 const design={...s.design,bands:Array.from({length:250},()=>structuredClone(s.design.bands[0]))};
 s.$('file').files[0].text=async()=>JSON.stringify(design);
 await s.$('file').onchange();
 assert.equal(s.context.state.bands.length,250);
 assert.equal(s.stored()[0].bands.length,250);
});
test('import confirms replacement of matching names and sizes',async()=>{
 const s=setup();const existing={...s.design,bands:[]};
 s.context.readLibrary=()=>[existing,{...existing,threadSize:'A'}];
 await s.$('file').onchange();
 assert.equal(s.prompts.length,1);assert.equal(s.stored().length,2);
 assert.ok(s.stored()[0].bands.length>0);assert.equal(s.stored()[1].threadSize,'A');
});
test('cancelled import replacement preserves the library and draft',async()=>{
 const s=setup({accept:false});s.context.readLibrary=()=>[s.design];
 await s.$('file').onchange();
 assert.equal(s.history.length,0);assert.equal(s.context.state.name,'Current');
 assert.equal(s.context.libraryRendered,undefined);assert.equal(s.$('file').value,'');
});
test('declining to discard the current draft does not save an import',async()=>{
 const s=setup({replace:false});await s.$('file').onchange();
 assert.equal(s.stored().length,0);assert.equal(s.history.length,0);
});
test('invalid and oversized imports do not change the draft or library',async()=>{
 for(const oversized of [false,true]){
  const s=setup({text:'{}'});if(oversized)s.$('file').files[0].size=250001;
  await s.$('file').onchange();
  assert.equal(s.stored().length,0);assert.equal(s.history.length,0);
  assert.match(s.messages.at(-1),/Cannot open/);assert.equal(s.$('file').value,'');
 }
});
test('storage failure still opens an import without claiming it was saved',async()=>{
 const s=setup({blocked:true});await s.$('file').onchange();
 assert.equal(s.context.state.name,s.design.name);assert.equal(s.stored().length,0);
 assert.equal(s.context.cleaned,undefined);assert.equal(s.context.libraryRendered,undefined);
 assert.match(s.messages.at(-1),/could not save in browser storage/);
});
