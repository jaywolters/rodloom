'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(blockStorage=false){
 const elements={};
 const $=id=>elements[id]??= {value:'',style:{},setCustomValidity(message){this.error=message;},reportValidity(){this.reported=true;}};
 const stored={};
 const context=vm.createContext({$,screenScale:3.25,displayScale:'actual',zoom:1,rodSide:'bottom',draw(){},notify(){},
  localStorage:{setItem(key,value){if(blockStorage)throw Error('blocked');stored[key]=value;}}
 });
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function updateScreenScale('),source.indexOf('const validColor')),context);
 return {elements,$,stored,context};
}
for(const measured of [25,50,65])test(`calibration corrects a line measured at ${measured} mm`,()=>{
 const {$,stored,context}=setup();
 $('measured-ruler').value=String(measured);
 $('apply-calibration').onclick();
 const expected=3.25*50/measured;
 assert.equal(context.screenScale,expected);
 assert.equal(stored['threadwrap-screen-scale'],expected);
 assert.equal($('calibration-ruler').style.width,`${50*expected}px`);
 assert.equal(Number($('screen-scale').value),expected);
 assert.equal($('measured-ruler').value,'');
});
for(const measured of ['',0,-1,'no',1,500])test(`invalid measured length ${JSON.stringify(measured)} leaves calibration unchanged`,()=>{
 const {$,context,stored}=setup();
 $('measured-ruler').value=measured;
 $('apply-calibration').onclick();
 assert.equal(context.screenScale,3.25);
 assert.ok($('measured-ruler').error);
 assert.ok($('measured-ruler').reported);
 assert.deepEqual(stored,{});
});
test('calibration works without storage and manual input preserves typed precision',()=>{
 const {$,context}=setup(true);
 $('measured-ruler').value='40';
 $('apply-calibration').onclick();
 assert.equal(context.screenScale,4.0625);
 $('screen-scale').value='2.280';
 $('screen-scale').oninput();
 assert.equal(context.screenScale,2.28);
 assert.equal($('screen-scale').value,'2.280');
 assert.equal($('calibration-ruler').style.width,`${50*2.28}px`);
});
test('zoom slider changes magnification without changing screen calibration',()=>{
 const {$,context}=setup();
 $('preview-zoom').value='3.7';
 $('preview-zoom').oninput();
 assert.equal(context.zoom,3.7);
 assert.equal(context.screenScale,3.25);
 assert.equal(context.displayScale,'detail');
 assert.equal($('zoom-value').textContent,'3.7×');
 $('display-scale').value='fit';$('display-scale').onchange();
 assert.equal($('zoom-value').textContent,'Fit');
 $('preview-zoom').value='1';$('preview-zoom').oninput();
 assert.equal(context.displayScale,'actual');
 assert.equal($('zoom-value').textContent,'1×');
});
test('actual size resets zoom and invalid slider values are ignored',()=>{
 const {$,context}=setup();
 $('preview-zoom').value='8';$('preview-zoom').oninput();
 assert.equal(context.zoom,8);
 $('display-scale').value='actual';$('display-scale').onchange();
 assert.equal(context.zoom,1);
 for(const value of ['bad','0','9']){
  $('preview-zoom').value=value;$('preview-zoom').oninput();
  assert.equal(context.zoom,1);
 }
});
test('side buttons select the opposite face without editing the design',()=>{
 const {$,context}=setup();
 for(const side of ['top','side','bottom']){
  const pressed={};
  $(`${side}-view`).classList={toggle(name,value){pressed.active=value;}};
  $(`${side}-view`).setAttribute=(name,value)=>pressed[name]=value;
  $(`${side}-view`).pressed=pressed;
 }
 $('top-view').onclick();
 assert.equal(context.rodSide,'top');
 assert.equal($('top-view').pressed['aria-pressed'],'true');
 assert.equal($('bottom-view').pressed['aria-pressed'],'false');
 $('side-view').onclick();
 assert.equal(context.rodSide,'side');
 assert.equal($('side-view').pressed['aria-pressed'],'true');
 assert.equal($('side-view').pressed.active,true);
 assert.equal($('top-view').pressed['aria-pressed'],'false');
 assert.equal($('bottom-view').pressed['aria-pressed'],'false');
 $('bottom-view').onclick();
 assert.equal(context.rodSide,'bottom');
 assert.equal($('side-view').pressed['aria-pressed'],'false');
});
