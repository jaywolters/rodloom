const {test} = require('node:test');
const assert = require('node:assert/strict');
const {wrapGeometry, bandMetrics, wrapSummary, spiralAdvance} = require('./geometry');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('Five paired revolutions use 2.5 mm at size D coverage',()=>{
 const m=bandMetrics({wrap:'spiral',turns:5},.25,15);
 near(m.length,2.5);near(m.pitch,.5);assert.equal(m.strands,2);
 near(m.threadLength,10*Math.hypot(Math.PI*15.25,.5)/1000);
});
test('Mixed solids and spiral lengths count strands, not just revolutions',()=>{
 const m=wrapSummary([{turns:40},{wrap:'spiral',turns:5},{turns:40}],.25,15);
 near(m.length,22.5);assert.equal(m.turns,85);
 near(m.threadLength,80*Math.hypot(Math.PI*15.25,.25)/1000+10*Math.hypot(Math.PI*15.25,.5)/1000);
});
test('Helix advances half a pitch on the visible hemisphere, full pitch unrolled',()=>{
 near(spiralAdvance(0,.5,false),0);near(spiralAdvance(1,.5,false),.25);
 near(spiralAdvance(.5,.5,false),.125);near(spiralAdvance(1,.5,true),.5);
 near(spiralAdvance(1,.5,true,-1),-.5);
});
for(const phase of [.25,.5])test(`${phase===.25?'Side':'Top'} shifts spirals without reversing their direction`,()=>{
 for(const flat of [false,true])for(const direction of [1,-1])for(const fraction of [0,.25,.5,.75,1]){
  near(spiralAdvance(fraction,.5,flat,direction,phase)-spiralAdvance(fraction,.5,flat,direction),direction*.5*phase);
 }
});
for(const screenScale of [2,3.78,6]) test(`Calibrated actual size at ${screenScale} px/mm`,()=>{
 const g=wrapGeometry({turns:40,coverage:.25,diameter:15,width:800,height:280,screenScale});
 near(g.blankHeight,15*screenScale);
 near(g.width,10*screenScale);
 near(g.pitch,.25*screenScale);
 near(g.height,15.5*screenScale);
});
for(const [width,height] of [[360,260],[800,302],[1600,640]]) {
 for(const turns of [1,84,1000,100000]) {
  for(const flat of [false,true]) {
   test(`${width}px / ${turns} turns / ${flat?'flat':'rod'}`,()=>{
    const g=wrapGeometry({turns,coverage:.25,diameter:8,width,height,flat});
    near(g.width/g.pixelsPerMm,turns*.25);
    near(g.height/g.pixelsPerMm,flat?Math.PI*8.25:8.5);
    near(g.pitch/g.blankHeight,.25/8);
    near(g.width,turns*g.pitch);
    assert.ok(g.width<=width*.74+1e-8);
    assert.ok(g.height<=height*.30+1e-8);
   });
  }
 }
}
