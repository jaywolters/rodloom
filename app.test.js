'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Save is only visible for changes and hides after saving or restoring the baseline',()=>{
 const save={},state={name:'Test',bands:[]};
 const context=vm.createContext({state,cleanDesign:JSON.stringify(state),$:()=>save,localStorage:{setItem(){}},notify(){}});
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function markClean(){'),source.indexOf('function confirmAction('))+source.slice(source.indexOf('function persist(){'),source.indexOf('const libraryKey=')),context);
 context.persist();assert.equal(save.hidden,true);
 state.name='Changed';context.persist();assert.equal(save.hidden,false);
 state.name='Test';context.persist();assert.equal(save.hidden,true);
 state.name='Saved';context.persist();context.markClean();assert.equal(save.hidden,true);
 state.bands.push({turns:1});context.persist();assert.equal(save.hidden,false);
});

function editor(){
 class Element {
  constructor(cls=''){this.className=cls;this.children=[];this.dataset={};this.style={};this.listeners={};this.classes=new Set();this.classList={add:(cls)=>this.classes.add(cls),remove:(cls)=>this.classes.delete(cls)};}
  append(...children){this.children.push(...children);for(const child of children)child.parent=this;}
  replaceChildren(){this.children=[];}
  setAttribute(name,value){(this.attributes??={})[name]=value;}
  cloneNode(deep){const copy=new Element(this.className);Object.assign(copy.dataset,this.dataset);copy.value=this.value;copy.open=this.open;copy.textContent=this.textContent;if(deep)copy.append(...this.children.map(child=>child.cloneNode(true)));return copy;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  addEventListener(type,fn){this.listeners[type]=fn;}
  removeEventListener(type){delete this.listeners[type];}
  closest(selector){if(selector==='details')return this.details;let el=this;while(el){if(el.className===selector.slice(1))return el;el=el.parent;}return null;}
  querySelector(selector){return this.querySelectorAll(selector)[0];}
  querySelectorAll(selector){const selectors=selector.split(',').map(s=>s.slice(1));return this.children.flatMap(child=>[...(selectors.some(s=>child.className===s||child.classes.has(s))?[child]:[]),...child.querySelectorAll(selector)]);}
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
 const context=vm.createContext({document:{body:new Element()},state,$,history:[],selectedBands:new Set(),bandClipboard:[],collapsedBandGroups:new Set(),make:(tag,cls,text)=>Object.assign(new Element(cls),{textContent:text}),refresh(){},notify(){},Option:Element,structuredClone,validColor:()=>true,isCatalogThread:()=>true});
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf('function copyBandGroups('),source.indexOf('function refresh(){'))+source.slice(source.indexOf('function addBand('),source.indexOf("$('mirror').onclick")),context);
 context.change=fn=>{context.history.push(structuredClone(context.state));fn();context.render();};
 context.render();
 return {context,state,list:$('bands')};
}
const names=list=>list.querySelectorAll('.band').map(row=>row.children[3].children[0].textContent);

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

test('new blank design preserves quick palette and dimensions, and keeps an undo snapshot',async()=>{
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
 assert.equal(context.state.quickColors.length,1);
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

test('Shift-click selects and deselects inclusive band ranges without changing the design',()=>{
 const {context,state,list}=editor(),before=JSON.stringify(state);
 const click=(index,checked,shiftKey=false)=>{
  const row=list.querySelectorAll('.band').find(row=>Number(row.dataset.index)===index);
  const checkbox=row.querySelector('.select-band');
  checkbox.checked=checked;checkbox.onclick({shiftKey});checkbox.onchange();
 };
 click(2,true);click(0,true,true);
 assert.equal(context.selectedBands.size,3);
 assert.ok(list.querySelectorAll('.select-band').every(box=>box.checked));
 click(0,false,true);
 assert.equal(context.selectedBands.size,0);
 assert.ok(list.querySelectorAll('.select-band').every(box=>!box.checked));
 click(0,true);click(2,true,true);
 assert.equal(context.selectedBands.size,3);
 assert.equal(JSON.stringify(state),before);
 assert.equal(context.history.length,0);
});

test('Shift-click ranges include both spiral strands from either checkbox',()=>{
 const {context,state,list}=editor();
 context.insertSpiral(0);
 const before=JSON.stringify(state),historyLength=context.history.length;
 const click=(index,strand,checked,shiftKey=false)=>{
  const row=list.querySelectorAll('.band').find(row=>Number(row.dataset.index)===index);
  const checkbox=row.querySelector(strand==='outgoing'?'.select-outgoing':'.select-band');
  checkbox.checked=checked;checkbox.onclick({shiftKey});checkbox.onchange();
 };
 const assertBoth=checked=>{
  const row=list.querySelectorAll('.band').find(row=>Number(row.dataset.index)===1);
  assert.equal(row.querySelector('.select-band').checked,checked);
  assert.equal(row.querySelector('.select-outgoing').checked,checked);
 };
 click(0,'incoming',true);click(2,'incoming',true,true);
 assertBoth(true);
 click(2,'incoming',false,true);
 assertBoth(false);assert.equal(context.selectedBands.size,0);
 click(1,'outgoing',true);
 assert.equal(context.selectedStrands(state.bands[1]).has('incoming'),false);
 click(0,'incoming',true,true);
 assertBoth(true);
 click(1,'outgoing',false,true);
 assertBoth(false);assert.equal(context.selectedBands.size,1);
 click(0,'incoming',false);
 click(0,'incoming',true);click(1,'outgoing',true,true);
 assertBoth(true);
 click(1,'outgoing',false,true);
 assertBoth(false);assert.equal(context.selectedBands.size,0);
 assert.equal(JSON.stringify(state),before);
 assert.equal(context.history.length,historyLength);
});

test('group names are editable, undoable, copied independently, and removed on ungroup',()=>{
 const {context,state,list}=editor();
 context.selectedBands=new Set(state.bands.slice(0,2));context.groupSelectedBands();
 const group=state.bands[0].group;
 const input=list.querySelector('.band-group-title');
 input.value='  Trim bands  ';input.onchange();
 assert.equal(list.querySelector('.band-group-title').value,'Trim bands');
 assert.ok(state.bands.slice(0,2).every(b=>b.groupName==='Trim bands'));
 assert.equal(context.history.at(-1).bands[0].groupName,undefined);
 const count=context.history.length;context.renameBandGroup(group,'Trim bands');
 assert.equal(context.history.length,count);
 context.copySelectedBands();context.pasteBands();
 const pastedGroup=state.bands.at(-1).group;
 assert.notEqual(pastedGroup,group);
 assert.equal(state.bands.at(-1).groupName,'Trim bands');
 context.renameBandGroup(pastedGroup,'Copy');
 assert.equal(state.bands[0].groupName,'Trim bands');
 context.ungroupSelectedBands();
 assert.equal(state.bands.at(-1).groupName,undefined);
 assert.equal(state.bands.at(-1).group,undefined);
 context.renameBandGroup(group,'   ');
 assert.equal(state.bands[0].groupName,undefined);
 assert.equal(list.querySelector('.band-group-title').value,'');
});

test('group ungroup and delete actions use icons with title tooltips',()=>{
 const {context,state,list}=editor();
 context.selectedBands=new Set(state.bands.slice(0,2));context.groupSelectedBands();
 const buttons=list.querySelectorAll('.group-action-icon');
 assert.deepEqual(buttons.map(button=>button.title),['Ungroup','Delete group']);
 for(const button of buttons){
  assert.equal(button.textContent,'');
  assert.match(button.innerHTML,/<svg .*aria-hidden="true"/);
 }
});

test('deleting a group confirms its name and band count and supports Undo',async()=>{
 const {context,state,list}=editor();
 context.selectedBands=new Set(state.bands.slice(0,2));context.groupSelectedBands();
 const group=state.bands[0].group;
 context.renameBandGroup(group,'Accent');
 const before=JSON.stringify(state),historyLength=context.history.length;
 const button=list.querySelectorAll('.group-action').at(-1);
 context.confirmAction=(message,title,accept)=>{
  assert.match(message,/Accent/);assert.match(message,/all 2 bands/);
  assert.equal(title,'Delete band group');assert.equal(accept,'Delete');return false;
 };
 await button.onclick({preventDefault(){}});
 assert.equal(JSON.stringify(state),before);
 assert.equal(context.history.length,historyLength);
 context.confirmAction=()=>true;
 await button.onclick({preventDefault(){}});
 assert.deepEqual(state.bands.map(b=>b.name),['C']);
 assert.equal(context.selectedBands.size,0);
 assert.equal(list.querySelectorAll('.band-group').length,0);
 assert.equal(context.history.length,historyLength+1);
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf("$('reverse').onclick="),source.indexOf("$('design-name').onchange=")),context);
 context.$('undo').onclick();
 assert.equal(JSON.stringify(context.state),before);
});

test('pending group deletion cannot remove bands from a different design',async()=>{
 const {context,state}=editor();
 context.selectedBands=new Set(state.bands.slice(0,2));context.groupSelectedBands();
 const group=state.bands[0].group;
 let confirm;
 context.confirmAction=()=>new Promise(resolve=>{confirm=resolve;});
 const pending=context.deleteBandGroup(group);
 context.state=structuredClone(state);
 const before=JSON.stringify(context.state),historyLength=context.history.length;
 confirm(true);await pending;
 assert.equal(JSON.stringify(context.state),before);
 assert.equal(context.history.length,historyLength);
});

test('named groups keep their names when replacing thread colors',()=>{
 const {context,state}=editor();
 context.selectedBands=new Set(state.bands.slice(0,2));context.groupSelectedBands();
 context.renameBandGroup(state.bands[0].group,'Accent');
 context.replaceSelectedBands({name:'Red',color:'#ff0000'});
 assert.ok(state.bands.slice(0,2).every(b=>b.groupName==='Accent'));
});

test('range anchor survives rerenders and resets when cleared or removed',()=>{
 const {context,state,list}=editor();
 context.selectBandRange(state.bands[0],true);
 context.render();context.selectBandRange(state.bands[2],true,true);
 assert.equal(context.selectedBands.size,3);
 context.$('clear-band-selection').onclick();
 context.selectBandRange(state.bands[1],true,true);
 assert.equal(context.selectedBands.size,1);
 state.bands.splice(1,1);context.render();
 context.selectBandRange(state.bands[1],true,true);
 assert.equal(context.selectedBands.size,1);
 assert.ok(list.querySelectorAll('.select-band').some(box=>box.checked));
});

test('preview clicks reveal the exact band without changing copy selection or design',()=>{
 const {context,state,list}=editor();
 const preview=context.$('preview');
 preview.getBoundingClientRect=()=>({left:100,top:20,width:800,height:200});
 preview.bandRegions=[{index:0,left:.1,right:.2,top:.25,bottom:.75},{index:2,left:.2,right:.3,top:.25,bottom:.75}];
 const before=JSON.stringify(state);
 context.revealPreviewBand({clientX:220,clientY:120});
 assert.equal(list.details.open,true);
 assert.ok(list.children[2].classes.has('preview-highlight'));
 assert.equal(list.children[2].querySelector('.turns').focused,true);
 assert.equal(list.children[2].scrolled.block,'center');
 context.revealPreviewBand({clientX:300,clientY:120});
 assert.ok(!list.children[2].classes.has('preview-highlight'));
 assert.ok(list.children[0].classes.has('preview-highlight'));
 context.revealPreviewBand({clientX:300,clientY:30});
 assert.ok(list.children[0].classes.has('preview-highlight'));
 assert.equal(context.selectedBands.size,0);
 assert.equal(JSON.stringify(state),before);
 assert.equal(context.history.length,0);
});

test('checking and unchecking bands immediately refreshes palette replacement controls',()=>{
 const {context,list}=editor();let refreshed=0;
 context.colorWorkspace={render(){refreshed++;}};
 const checkbox=list.children[0].children[1];
 checkbox.checked=true;checkbox.onchange();
 assert.equal(context.selectedBands.size,1);
 assert.equal(refreshed,1);
 checkbox.checked=false;checkbox.onchange();
 assert.equal(context.selectedBands.size,0);
 assert.equal(refreshed,2);
});

test('band chips reveal the correct quick palette thread including both spiral strands',()=>{
 const {context,state,list}=editor(),revealed=[];
 context.colorWorkspace={render(){},revealQuick:thread=>revealed.push(thread)};
 list.children[0].children[2].onclick();
 assert.equal(revealed[0],state.bands[2]);
 state.bands[2].wrap='spiral';state.bands[2].secondary={name:'Incoming',color:'#abcdef'};
 context.render();
 const row=list.children[0];
 row.children[2].onclick();
 row.children.at(-1).children[1].onclick();
 assert.equal(revealed[1],state.bands[2].secondary);
 assert.equal(revealed[2],state.bands[2]);
 assert.equal(context.history.length,0);
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
 assert.deepEqual([...context.selectedBands],[state.bands[0],state.bands[2],state.bands[5],state.bands[6]]);
 assert.equal(context.selectedStrands(state.bands[5]).has('incoming'),true);
 assert.equal(context.selectedStrands(state.bands[6]).has('outgoing'),true);
 assert.equal(context.selectedStrands(state.bands[6]).has('incoming'),false);
 context.selectedBands.add(state.bands[1]);context.selectSameColor();
 assert.deepEqual([...context.selectedBands],[state.bands[0],state.bands[1],state.bands[2],state.bands[5],state.bands[6]]);
 assert.equal(context.history.length,0);
 context.$('clear-band-selection').onclick();
 assert.equal(context.$('select-same-color').disabled,true);
});

test('context color matching targets the clicked spiral strand rather than other selections',()=>{
 const {context,state}=editor();
 const thread=sku=>({name:sku,brand:'ProWrap',line:'Nylon',sku,color:'#123456',turns:1});
 const spiral={...thread('green'),wrap:'spiral',secondary:thread('silver'),direction:1};
 state.bands=[thread('green'),thread('silver'),spiral];context.render();
 context.selectSpiralStrand(spiral,'incoming',true);
 context.selectSameColor([spiral]);
 assert.deepEqual([...context.selectedBands],[state.bands[0],spiral]);
 assert.equal(context.selectedStrands(spiral).has('outgoing'),true);
 assert.equal(context.selectedStrands(spiral).has('incoming'),false);
 context.selectSameColor([spiral.secondary]);
 assert.deepEqual([...context.selectedBands],[state.bands[1],spiral]);
 assert.equal(context.selectedStrands(spiral).has('incoming'),true);
 assert.equal(context.selectedStrands(spiral).has('outgoing'),false);
 assert.equal(context.history.length,0);
});

test('spiral checkboxes select and replace either strand independently',()=>{
 const {context,state,list}=editor();
 context.insertSpiral(0);
 const spiral=state.bands[1];
 const row=list.querySelectorAll('.band').find(row=>Number(row.dataset.index)===1);
 const outgoing=row.querySelector('.select-outgoing');
 assert.equal(outgoing.checked,false);
 outgoing.checked=true;outgoing.onchange();
 assert.equal(row.querySelector('.select-band').checked,false);
 assert.equal(context.selectedBands.has(spiral),true);
 const replacement={name:'White',color:'#ffffff',brand:'ProWrap',sku:'807',catalog:true,finish:'regular',line:'Nylon'};
 const incoming=structuredClone(spiral.secondary),turns=spiral.turns;
 context.replaceSelectedBands(replacement);
 assert.equal(spiral.name,'White');assert.deepEqual(spiral.secondary,incoming);
 assert.equal(spiral.turns,turns);assert.equal(spiral.direction,1);
 context.selectBandRange(spiral,true);
 context.replaceSelectedBands({...replacement,name:'Red',color:'#ff0000'});
 assert.equal(spiral.name,'Red');assert.equal(spiral.secondary.name,'Red');
 context.selectBandRange(spiral,false);
 assert.equal(context.selectedBands.has(spiral),true);
 context.selectSpiralStrand(spiral,'outgoing',false);
 assert.equal(context.selectedBands.has(spiral),false);
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
  assert.equal(list.children.find(row=>row.children[0].focused).children[3].children[0].textContent,from===2?'A':'C');
 }
});

test('adjacent bands group, move together, persist in undo, and ungroup',()=>{
 const {context,state,list}=editor();
 context.selectedBands=new Set(state.bands.slice(0,2));context.render();
 context.$('group-bands').onclick();
 assert.equal(state.bands[0].group,state.bands[1].group);
 assert.ok(state.bands[0].group);
 assert.equal(list.children[1].children[1].children[0].disabled,false);
 list.children[1].querySelectorAll('.group-action')[0].onclick({preventDefault(){}});
 assert.deepEqual(state.bands.map(b=>b.name),['C','A','B']);
 assert.deepEqual(names(list),['B','A','C']);
 assert.equal(context.history.length,2);
 assert.deepEqual(context.history[1].bands.map(b=>b.name),['A','B','C']);
 list.children[0].querySelectorAll('.group-action')[1].onclick({preventDefault(){}});
 assert.deepEqual(state.bands.map(b=>b.name),['A','B','C']);
 context.$('ungroup-bands').onclick();
 assert.ok(state.bands.every(b=>!b.group));
});

test('group headers collapse independently and grouped bands have no spiral insertion option',()=>{
 const {context,state,list}=editor();
 state.bands[0].group=state.bands[1].group='pair';context.render();
 const group=list.children[1];
 assert.equal(group.className,'band-group');
 assert.equal(group.open,true);
 assert.equal(group.children[0].className,'band-group-header');
 assert.equal(group.querySelectorAll('.insert-spiral').length,0);
 group.isConnected=true;group.open=false;group.listeners.toggle();
 context.render();assert.equal(list.children[1].open,false);
 const preview=context.$('preview');
 preview.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
 preview.bandRegions=[{index:0,left:0,right:1,top:0,bottom:1}];
 context.revealPreviewBand({clientX:50,clientY:50});
 assert.equal(list.children[1].open,true);
 assert.equal(list.children[1].children[2].querySelector('.turns').focused,true);
 context.render();assert.equal(list.children[1].open,true);
});

test('group header dragging moves the whole collapsed group with one undo and cancellation is inert',()=>{
 const {context,state,list}=editor();
 state.bands[0].group=state.bands[1].group='pair';context.collapsedBandGroups.add('pair');context.render();
 const drag=list.children[1].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:-10});
 drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['C','A','B']);
 assert.equal(context.history.length,1);
 assert.equal(list.children[0].open,false);
 const next=list.children[0].querySelector('.drag-handle');
 next.listeners.pointerdown({button:0,pointerId:2,preventDefault(){}});
 next.listeners.pointermove({clientY:1000});
 next.listeners.pointercancel({type:'pointercancel'});
 assert.deepEqual(state.bands.map(b=>b.name),['C','A','B']);
 assert.equal(context.history.length,1);
 next.listeners.pointerdown({button:0,pointerId:3,preventDefault(){}});
 next.listeners.pointermove({clientY:1000});
 next.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['A','B','C']);
});

test('loose bands can be dragged into named collapsed groups with one undo',()=>{
 const {context,state,list}=editor();
 state.bands[1].group=state.bands[2].group='pair';
 state.bands[1].groupName=state.bands[2].groupName='Accent';
 context.collapsedBandGroups.add('pair');context.render();
 const group=list.children[0],drag=list.children[1].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:50});
 assert.ok(group.classes.has('drop-into'));
 drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['B','C','A']);
 assert.ok(state.bands.every(b=>b.group==='pair'&&b.groupName==='Accent'));
 assert.equal(context.history.length,1);
 assert.equal(context.history[0].bands[0].group,undefined);
 assert.equal(list.children.length,1);
 assert.equal(list.children[0].open,false);
});

test('bands can join expanded groups in between colors and cancellation is inert',()=>{
 const {context,state,list}=editor();
 state.bands[1].group=state.bands[2].group='pair';context.render();
 const group=list.children[0];
 group.getBoundingClientRect=()=>({top:0,height:400});
 const drag=list.children[1].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:200});
 drag.listeners.pointercancel({type:'pointercancel'});
 assert.deepEqual(state.bands.map(b=>b.name),['A','B','C']);
 assert.equal(context.history.length,0);
 assert.ok(!group.classes.has('drop-into'));
 drag.listeners.pointerdown({button:0,pointerId:2,preventDefault(){}});
 drag.listeners.pointermove({clientY:200});
 drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['B','A','C']);
 assert.ok(state.bands.every(b=>b.group==='pair'));
 assert.equal(context.history.length,1);
});

test('joining an adjacent group changes membership even without changing order',()=>{
 const {context,state,list}=editor();
 state.bands[1].group=state.bands[2].group='pair';context.render();
 const group=list.children[0];group.getBoundingClientRect=()=>({top:0,height:400});
 const drag=list.children[1].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:350});
 drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['A','B','C']);
 assert.ok(state.bands.every(b=>b.group==='pair'));
 assert.equal(context.history.length,1);
});

test('drag ghosts follow the pointer and are removed on drop, cancel, and lost capture',()=>{
 for(const type of ['pointerup','pointercancel','lostpointercapture']){
  const {context,list}=editor();
  const row=list.children[0],drag=row.querySelector('.drag-handle');
  row.getBoundingClientRect=()=>({left:100,top:200,width:400,height:70});
  drag.listeners.pointerdown({button:0,pointerId:1,clientX:110,clientY:220,preventDefault(){}});
  const ghost=context.document.body.children[0];
  assert.ok(ghost.classes.has('band-drag-ghost'));
  assert.equal(ghost.attributes['aria-hidden'],'true');assert.equal(ghost.inert,true);
  assert.equal(ghost.style.width,'400px');
  assert.equal(ghost.style.left,'100px');assert.equal(ghost.style.top,'200px');
  drag.listeners.pointermove({clientX:150,clientY:260});
  assert.equal(ghost.style.left,'140px');assert.equal(ghost.style.top,'240px');
  assert.ok(ghost.querySelector('.band-color-chip'));
  drag.listeners[type]({type});
  assert.equal(context.document.body.children.length,0);
  assert.ok(!row.classes.has('dragging'));
 }
});

test('grouped color drag handles are enabled and not hidden by CSS',()=>{
 const {context,state,list}=editor();
 state.bands[0].group=state.bands[1].group='pair';context.render();
 for(const row of list.querySelectorAll('.grouped-band'))assert.equal(row.querySelector('.drag-handle').disabled,false);
 const css=fs.readFileSync('style.css','utf8');
 assert.doesNotMatch(css,/\.grouped-band\s*>\s*\.drag-handle\s*\{[^}]*(?:visibility\s*:\s*hidden|display\s*:\s*none)/);
});

test('clicking a grouped drag handle without moving leaves membership unchanged',()=>{
 const {context,state,list}=editor();
 state.bands[0].group=state.bands[1].group='pair';context.render();
 const before=JSON.stringify(state),drag=list.children[1].querySelector('.band').querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointerup({type:'pointerup'});
 assert.equal(JSON.stringify(state),before);assert.equal(context.history.length,0);
});

test('expanded groups show the exact insertion boundary and clear old markers',()=>{
 const {context,state,list}=editor();
 for(const b of state.bands)b.group='pair';context.render();
 const group=list.children[0],bands=group.querySelectorAll('.band');
 group.getBoundingClientRect=()=>({top:0,height:500});
 const drag=bands[2].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:50});
 assert.ok(bands[0].classes.has('drop-before'));
 drag.listeners.pointermove({clientY:200});
 assert.ok(!bands[0].classes.has('drop-before'));
 assert.ok(bands[1].classes.has('drop-before'));
 drag.listeners.pointermove({clientY:350});
 assert.ok(!bands[1].classes.has('drop-before'));
 assert.ok(bands[1].classes.has('drop-after'));
 assert.ok(!bands[2].classes.has('drop-before')&&!bands[2].classes.has('drop-after'));
 drag.listeners.pointermove({clientY:200});
 assert.ok(!bands[1].classes.has('drop-after'));
 drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['B','A','C']);
 for(const band of bands){assert.ok(!band.classes.has('drop-before'));assert.ok(!band.classes.has('drop-after'));}
 assert.equal(context.history.length,1);
});

test('grouped bands reorder within their group independently',()=>{
 const {context,state,list}=editor();
 for(const b of state.bands){b.group='pair';b.groupName='Accent';}context.render();
 const group=list.children[0];group.getBoundingClientRect=()=>({top:0,height:500});
 const drag=group.querySelectorAll('.band')[2].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:50});drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['B','C','A']);
 assert.ok(state.bands.every(b=>b.group==='pair'&&b.groupName==='Accent'));
 assert.equal(context.history.length,1);
});

test('grouped bands can be dragged outside without moving the remaining group',()=>{
 const {context,state,list}=editor();
 state.bands[0].group=state.bands[1].group='pair';
 state.bands[0].groupName=state.bands[1].groupName='Accent';context.render();
 const drag=list.children[1].querySelectorAll('.band')[1].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:-10});drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['B','C','A']);
 assert.equal(state.bands[0].group,'pair');assert.equal(state.bands[0].groupName,'Accent');
 assert.equal(state.bands[2].group,undefined);assert.equal(state.bands[2].groupName,undefined);
 assert.equal(context.history.length,1);
});

test('grouped bands can join another collapsed group and adopt its name',()=>{
 const {context,state,list}=editor();
 state.bands[0].group=state.bands[1].group='first';
 state.bands[2].group='second';state.bands[2].groupName='Target';
 context.collapsedBandGroups.add('second');context.render();
 const drag=list.children[1].querySelectorAll('.band')[1].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:50});drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['B','C','A']);
 assert.equal(state.bands[0].group,'first');
 assert.ok(state.bands.slice(1).every(b=>b.group==='second'&&b.groupName==='Target'));
 assert.equal(context.history.length,1);
});

test('pulling the last band out removes its empty group even without reordering',()=>{
 const {context,state,list}=editor();
 state.bands[1].group='single';state.bands[1].groupName='Solo';context.render();
 const drag=list.children[1].querySelector('.band').querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:50});drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['A','B','C']);
 assert.equal(state.bands[1].group,undefined);assert.equal(state.bands[1].groupName,undefined);
 assert.equal(list.querySelectorAll('.band-group').length,0);
 assert.equal(context.history.length,1);
});

test('single band dragging cannot split a group',()=>{
 const {context,state,list}=editor();
 state.bands[1].group=state.bands[2].group='pair';context.render();
 const drag=list.children[1].querySelector('.drag-handle');
 drag.listeners.pointerdown({button:0,pointerId:1,preventDefault(){}});
 drag.listeners.pointermove({clientY:-10});
 drag.listeners.pointerup({type:'pointerup'});
 assert.deepEqual(state.bands.map(b=>b.name),['B','C','A']);
});

test('groups swap as blocks and copied groups get independent identities',()=>{
 const {context,state}=editor();
 state.bands.push({name:'D',color:'#123456',turns:1});
 state.bands[0].group=state.bands[1].group='first';
 state.bands[2].group=state.bands[3].group='second';
 context.moveBandBlock(0,true);
 assert.deepEqual(state.bands.map(b=>b.name),['C','D','A','B']);
 context.selectedBands=new Set(state.bands.slice(2));
 context.copySelectedBands();context.pasteBands();
 assert.notEqual(state.bands[4].group,state.bands[2].group);
 assert.equal(state.bands[4].group,state.bands[5].group);
});

test('nonadjacent selection cannot be grouped and individual moves do not split groups',()=>{
 const {context,state}=editor();
 context.selectedBands=new Set([state.bands[0],state.bands[2]]);
 context.groupSelectedBands();assert.equal(context.history.length,0);
 state.bands[1].group=state.bands[2].group='pair';
 context.moveBandBlock(0,true);
 assert.deepEqual(state.bands.map(b=>b.name),['B','C','A']);
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
 assert.equal(spiral.children[2].style.background,state.bands[1].secondary.color);
 assert.equal(paired.children[1].style.background,state.bands[1].color);
 assert.equal(paired.children[2].textContent,'A');
});
