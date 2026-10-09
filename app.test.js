'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function editor(){
 class Element {
  constructor(cls=''){this.className=cls;this.children=[];this.dataset={};this.style={};this.listeners={};this.classList={add(){},remove(){}};}
  append(...children){this.children.push(...children);for(const child of children)child.parent=this;}
  replaceChildren(){this.children=[];}
  setAttribute(){}
  addEventListener(type,fn){this.listeners[type]=fn;}
  removeEventListener(type){delete this.listeners[type];}
  closest(selector){return selector==='.band'?this.parent:this.details;}
  querySelector(selector){return this.children.find(child=>child.className===selector.slice(1));}
  querySelectorAll(){return [];}
  getBoundingClientRect(){const top=this.parent.children.indexOf(this)*100;return {top,height:100};}
  setPointerCapture(){}
  hasPointerCapture(){return false;}
  focus(){this.focused=true;}
  scrollIntoView(options){this.scrolled=options;}
  get firstElementChild(){return this.children[0];}
 }
 const elements={};
 const $=id=>elements[id]??=(new Element());
 $('bands').details={open:false};
 const state={name:'Test',bands:['A','B','C'].map(name=>({name,color:'#123456',turns:1}))};
 const context=vm.createContext({state,$,history:[],selectedBands:new Set(),bandClipboard:[],make:(tag,cls,text)=>Object.assign(new Element(cls),{textContent:text}),refresh(){},notify(){},Option:Element,structuredClone,validColor:()=>true,isCatalogThread:()=>true});
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function updateBlockControls(){'),source.indexOf('function refresh(){'))+source.slice(source.indexOf('function addBand('),source.indexOf("$('mirror').onclick")),context);
 context.change=fn=>{context.history.push(structuredClone(context.state));fn();context.render();};
 context.render();
 return {context,state,list:$('bands')};
}
const names=list=>list.children.map(row=>row.children[3].children[0].value);

function blankDesignEditor(unsaved){
 const result=editor(),{context}=result;
 Object.assign(context.state,{coverage:.25,diameter:15,blank:'#222222',texture:true,quickColors:[{name:'Working red'}]});
 context.hasUnsavedChanges=()=>unsaved;
 context.confirmAction=()=>{throw Error('Blank design should clear immediately without a confirmation dialog');};
 context.markClean=()=>{context.cleaned=true;};
 context.change=fn=>{context.history.push(structuredClone(context.state));fn();context.render();};
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function startNewDesign(){'),source.indexOf('function renderStartingPoints(){')),context);
 return result;
}

test('new blank design clears colors, preserves dimensions, and keeps an undo snapshot',async()=>{
 const {context}=blankDesignEditor(false);
 await context.$('new-design').onclick();
 assert.equal(context.state.name,'');
 assert.equal(context.$('design-name').value,'');
 assert.equal(context.state.bands.length,0);
 assert.equal(context.$('bands').children.filter(row=>row.className==='band').length,0);
 assert.equal(context.$('band-count').textContent,'0 bands');
 assert.equal(context.state.coverage,.25);
 assert.equal(context.state.diameter,15);
 assert.equal(context.state.blank,'#101314');
 assert.equal(context.state.texture,true);
 assert.equal(context.history[0].bands.length,3);
 assert.equal(context.state.quickColors.length,0);
 assert.equal(context.history[0].quickColors.length,1);
 assert.equal(context.cleaned,true);
 assert.equal(context.prompted,undefined);
 assert.equal(context.$('design-name').focused,true);
});

test('new blank design clears unsaved designs immediately and Undo restores them',()=>{
 const {context}=blankDesignEditor(true);
 const previous=JSON.stringify(context.state);
 context.$('new-design').onclick();
 assert.equal(context.state.bands.length,0);
 assert.equal(context.history.length,1);
 assert.equal(context.cleaned,true);
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf("$('reverse').onclick="),source.indexOf("$('design-name').onchange=")),context);
 context.$('undo').onclick();
 assert.equal(JSON.stringify(context.state),previous);
});

test('design library shows saved designs before standard designs',()=>{
 const {context}=editor();
 const saved={name:'My saved design',bands:[]};
 context.readLibrary=()=>[saved];
 context.standardDesigns=[{name:'Standard design',bands:[]}];
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function renderStartingPoints(){'),source.indexOf('const filename=')),context);
 context.renderStartingPoints();
 const entries=context.$('presets').children;
 assert.deepEqual(entries.map(entry=>entry.children[0].children[1].textContent),['My saved design','Standard design']);
 assert.equal(entries[0].children.length,2);
 assert.equal(entries[1].children.length,1);
});

test('editor displays reversed wrap order and new colors at the top',()=>{
 const {context,state,list}=editor();
 assert.deepEqual(names(list),['C','B','A']);
 context.addBand({name:'D',color:'#123456',turns:1});
 assert.deepEqual(names(list),['D','C','B','A']);
 assert.deepEqual(state.bands.map(b=>b.name),['A','B','C','D']);
 assert.equal(list.firstElementChild.scrolled.block,'start');
});

test('palette additions can keep the current viewport instead of scrolling to bands',()=>{
 const {context,list}=editor();
 assert.equal(context.addBand({name:'D',color:'#123456',turns:10},{reveal:false}),true);
 assert.equal(list.firstElementChild.scrolled,undefined);
});

test('cloning a band preserves turns and independently copies a paired spiral',()=>{
 const {context,state,list}=editor();
 context.insertSpiral(0);
 state.bands[1].turns=13;
 list.children[2].children[5].children[3].onclick();
 const clone=state.bands.at(-1),original=state.bands[1];
 assert.deepEqual(clone,structuredClone(original));
 assert.notEqual(clone,original);
 assert.notEqual(clone.secondary,original.secondary);
 clone.secondary.name='Independent';
 assert.equal(original.secondary.name,'B');
});

test('blocks copy in wrap order, paste independently, and repeat with one undo per paste',()=>{
 const {context,state,list}=editor();
 const select=row=>{const checkbox=row.children[1];checkbox.checked=true;checkbox.onchange();};
 select(list.children[1]);select(list.children[2]);
 context.$('copy-bands').onclick();
 assert.equal(context.history.length,0);
 state.bands[0].turns=12;
 context.$('paste-bands').onclick();
 assert.deepEqual(state.bands.map(b=>b.name),['A','B','C','A','B']);
 assert.equal(state.bands[3].turns,1);
 state.bands[3].turns=11;
 context.$('paste-bands').onclick();
 assert.equal(state.bands[5].turns,1);
 assert.equal(context.history.length,2);
 assert.equal(context.history.at(-1).bands.length,5);
 assert.equal(context.selectedBands.size,2);
 assert.equal(list.firstElementChild.scrolled.block,'start');
 context.$('clear-band-selection').onclick();
 assert.equal(context.$('copy-bands').disabled,true);
 assert.equal(context.bandClipboard.length,2);
});

test('block paste preserves nested spirals and rejects overflow without a partial paste',()=>{
 const {context,state}=editor();
 context.insertSpiral(0);
 context.selectedBands.add(state.bands[1]);context.copySelectedBands();context.pasteBands();
 assert.notEqual(state.bands.at(-1).secondary,state.bands[1].secondary);
 state.bands.at(-1).secondary.name='Independent';
 assert.equal(context.bandClipboard[0].secondary.name,'B');
 while(state.bands.length<100)state.bands.push(structuredClone(state.bands[0]));
 const checkpoints=context.history.length;
 context.pasteBands();
 assert.equal(state.bands.length,100);
 assert.equal(context.history.length,checkpoints);
 context.state=structuredClone(state);context.render();
 assert.equal(context.selectedBands.size,0);
 assert.equal(context.$('paste-bands').disabled,true);
});

test('palette replacement preserves turns, selection, and spiral geometry with one undo snapshot',()=>{
 const {context,state}=editor();
 context.insertSpiral(0);
 const solid=state.bands[0],spiral=state.bands[1],untouched=structuredClone(state.bands[2]);
 solid.turns=12;solid.source='old source';
 context.selectedBands.add(solid);context.selectedBands.add(spiral);
 const replacement={name:'White',color:'#ffffff',brand:'ProWrap',sku:'RNS-D-807',catalog:true,finish:'regular',line:'Nylon'};
 const before=JSON.stringify(state),count=context.history.length;
 assert.equal(context.replaceSelectedBands(replacement),true);
 assert.equal(context.history.length,count+1);
 assert.equal(JSON.stringify(context.history.at(-1)),before);
 assert.equal(solid.turns,12);assert.equal(solid.name,'White');assert.equal(solid.source,undefined);
 assert.equal(spiral.name,'A');assert.equal(spiral.secondary.name,'White');
 assert.equal(spiral.turns,5);assert.equal(spiral.direction,1);assert.equal(spiral.wrap,'spiral');
 assert.deepEqual(state.bands[2],untouched);
 assert.equal(context.selectedBands.size,2);
 assert.notEqual(spiral.secondary,replacement);
 context.selectedBands.clear();
 assert.equal(context.replaceSelectedBands(replacement),false);
 assert.equal(context.history.length,count+1);
});

test('select same color matches catalog threads, supports multiple colors, and makes no undo entry',()=>{
 const {context,state}=editor();
 const thread=(sku,line='Nylon')=>({name:sku,brand:'ProWrap',line,sku,color:'#123456',turns:1});
 state.bands=[thread('black'),thread('white'),thread('black'),thread('grey'),thread('black','ColorFast'),
  {...thread('grey'),wrap:'spiral',secondary:thread('black'),direction:1},
  {...thread('black'),wrap:'spiral',secondary:thread('grey'),direction:1}];
 context.render();
 assert.equal(context.$('select-same-color').disabled,true);
 context.selectedBands.add(state.bands[0]);context.render();
 assert.equal(context.$('select-same-color').disabled,false);
 context.$('select-same-color').onclick();
 assert.deepEqual([...context.selectedBands],[state.bands[0],state.bands[2],state.bands[5]]);
 context.selectedBands.add(state.bands[1]);context.selectSameColor();
 assert.deepEqual([...context.selectedBands],[state.bands[0],state.bands[1],state.bands[2],state.bands[5]]);
 assert.equal(context.history.length,0);
 context.$('clear-band-selection').onclick();
 assert.equal(context.$('select-same-color').disabled,true);
});

test('cloning respects the design band limit',()=>{
 const {context,state}=editor();
 state.bands=Array.from({length:100},()=>({name:'A',color:'#123456',turns:1}));
 assert.equal(context.addBand(state.bands[0]),false);
 assert.equal(state.bands.length,100);
});

test('move arrows follow visible order with correct edge disabling',()=>{
 const {state,list}=editor();
 assert.equal(list.children[0].children[5].children[0].disabled,true);
 assert.equal(list.children[2].children[5].children[1].disabled,true);
 list.children[1].children[5].children[0].onclick();
 assert.deepEqual(names(list),['B','C','A']);
 assert.deepEqual(state.bands.map(b=>b.name),['A','C','B']);
 list.children[0].children[5].children[1].onclick();
 assert.deepEqual(names(list),['C','B','A']);
});

test('dragging maps visual insertion positions back to wrap order',()=>{
 for(const [from,y,expected] of [[2,0,['A','C','B']],[0,400,['B','A','C']],[0,180,['B','C','A']]]){
  const {context,list}=editor();
  const handle=list.children[from].children[0];
  context.startBandDrag({button:0,pointerId:1,preventDefault(){}},Number(list.children[from].dataset.index),handle);
  handle.listeners.pointermove({clientY:y});
  handle.listeners.pointerup({type:'pointerup'});
  assert.deepEqual(names(list),expected);
  assert.equal(list.children.find(row=>row.children[0].focused).children[3].children[0].value,from===2?'A':'C');
 }
});

test('spirals keep wrap order but display incoming above outgoing to match neighbors',()=>{
 const {context,state,list}=editor();
 state.bands[0].color='#112233';
 state.bands[1].color='#445566';
 list.children[2].children[6].onclick();
 assert.equal(state.bands[1].wrap,'spiral');
 assert.equal(state.bands[1].name,'A');
 assert.equal(state.bands[1].secondary.name,'B');
 assert.deepEqual(names(list),['C','B','B','A']);
 const spiral=list.children[2];
 const paired=spiral.children[6];
 assert.equal(spiral.children[2].value,state.bands[1].secondary.color);
 assert.equal(paired.children[1].value,state.bands[1].color);
 assert.equal(paired.children[2].value,'A');
});
