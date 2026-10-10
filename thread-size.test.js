'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup(accept=true,bands=[{turns:10}]){
 const elements={};
 const $=id=>elements[id]??={value:''};
 const state={name:'Pattern',threadSize:'D',coverage:.27,bands};
 const history=[],prompts=[];
 const context=vm.createContext({$,state,history,confirmAction:async message=>{prompts.push(message);return accept;},change:fn=>{history.push(structuredClone(context.state));fn();}});
 vm.runInContext(source.slice(source.indexOf("$('thread-size').onchange="),source.indexOf("for(const id of ['coverage'")),context);
 return {context,$,history,prompts};
}
test('converting D to A requires confirmation, resets coverage, preserves turns and can undo',async()=>{
 const {context,$,history,prompts}=setup();
 $('thread-size').value='A';await $('thread-size').onchange();
 assert.equal(prompts.length,1);
 assert.match(prompts[0],/Turn counts stay unchanged/);
 assert.equal(context.state.threadSize,'A');assert.equal(context.state.coverage,.15);
 assert.equal(context.state.bands[0].turns,10);
 context.state=history.pop();assert.equal(context.state.threadSize,'D');assert.equal(context.state.coverage,.27);
});
test('cancelled conversion leaves size, coverage and history unchanged',async()=>{
 const {context,$,history}=setup(false);
 $('thread-size').value='A';await $('thread-size').onchange();
 assert.equal(context.state.threadSize,'D');assert.equal(context.state.coverage,.27);
 assert.equal($('thread-size').value,'D');assert.equal(history.length,0);
});
test('empty designs allow size selection and A to D conversion also confirms',async()=>{
 const {context,$,prompts}=setup(true,[]);
 $('thread-size').value='A';await $('thread-size').onchange();
 assert.equal(prompts.length,0);assert.equal(context.state.coverage,.15);
 context.state.bands=[{turns:5}];
 $('thread-size').value='D';await $('thread-size').onchange();
 assert.equal(prompts.length,1);assert.equal(context.state.coverage,.25);
});
test('size persists through validation and legacy designs default to D',()=>{
 const context=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync('standard-designs.js','utf8'),context);
 vm.runInContext(source.slice(source.indexOf('const isCatalogThread ='),source.indexOf('const standardDesigns='))+source.slice(source.indexOf('const validColor ='),source.indexOf('try {const saved=')),context);
 const design=context.window.RODLOOM_STANDARD_DESIGNS[0];
 assert.equal(context.validate(design).threadSize,'D');
 const restored=context.validate(JSON.parse(JSON.stringify({...design,threadSize:'A',coverage:.16})));
 assert.equal(restored.threadSize,'A');assert.equal(restored.coverage,.16);
 assert.throws(()=>context.validate({...design,threadSize:'B'}),/Invalid thread size/);
});
test('saving the same name keeps A and D variants separate',async()=>{
 const {context,$}=setup();let stored=[];
 Object.assign(context,{libraryKey:'threadwrap-designs',validate:d=>({...d}),readLibrary:()=>stored,localStorage:{setItem(key,value){stored=JSON.parse(value);}},markClean(){},renderLibrary(){},notify(){}});
 $('design-name').value='Pattern';
 vm.runInContext(source.slice(source.indexOf("$('save').onclick="),source.indexOf("$('export').onclick=")),context);
 await $('save').onclick();
 context.state.threadSize='A';context.state.coverage=.15;
 await $('save').onclick();
 assert.equal(stored.length,2);assert.deepEqual(stored.map(d=>d.threadSize),['D','A']);
});
