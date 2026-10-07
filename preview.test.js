'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {wrapSummary,wrapGeometry}=require('./geometry');

function dimensions(displayScale,mode,exporting=false){
 const stage={clientWidth:1000,clientHeight:258};
 const context=vm.createContext({displayScale,mode,screenScale:3.25,wrapSummary,
  state:{bands:[{turns:10000}],coverage:.25,diameter:50},
  $:id=>id==='preview'?{parentElement:stage}:{setAttribute(){}},
 });
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf("function draw(target=$('preview')"),source.indexOf(' const dpr=exporting?'))+'return {w,h};}',context);
 return context.draw(undefined,exporting);
}

for(const scale of ['actual','fit','detail'])for(const mode of ['rod','flat']){
 test(`${scale} ${mode} preview allows horizontal overflow only`,()=>{
  const size=dimensions(scale,mode);
  assert.equal(size.w,scale==='fit'?1000:4000);
  assert.equal(size.h,258);
 });
}
test('image export retains its full resolution',()=>{
 const size=dimensions('actual','rod',true);
 assert.equal(size.w,1600);
 assert.equal(size.h,640);
});
for(const mode of ['rod','flat'])test(`empty ${mode} preview draws only the background and bare rod`,()=>{
 const fills=[],labels=[];
 const ctx={scale(){},save(){},restore(){},
  fillRect(...rect){fills.push({color:this.fillStyle,rect});},
  fillText(text){labels.push(text);}
 };
 const target={parentElement:{clientWidth:1000,clientHeight:258},style:{},getContext:()=>ctx};
 const context=vm.createContext({displayScale:'actual',mode,screenScale:3.25,wrapSummary,wrapGeometry,
  state:{bands:[],coverage:.25,diameter:15,blank:'#101314'},
  document:{documentElement:{dataset:{}}},window:{devicePixelRatio:1},
  $:id=>id==='preview'?target:{setAttribute(){}}
 });
 const source=fs.readFileSync('app.js','utf8');
 vm.runInContext(source.slice(source.indexOf("function draw(target=$('preview')"),source.indexOf('function addBand(b){')),context);
 context.draw();
 assert.deepEqual(fills.map(fill=>fill.color),['#e6edf2','#101314']);
 assert.ok(labels.includes('Bare rod · choose thread colors to start'));
 assert.ok(!labels.some(label=>label.includes('finished revolutions')));
});
test('preview CSS permits horizontal but not vertical scrolling',()=>{
 assert.ok(fs.readFileSync('style.css','utf8').includes('.preview-stage{overflow-x:auto;overflow-y:hidden}'));
});
