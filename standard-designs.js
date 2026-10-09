// Built-in patterns, including the exported designs from rod themes.
// Spiral threads retain their catalog metadata and original wrap order.
window.RODLOOM_STANDARD_DESIGNS = (() => {
 const thread = (name,color,finish,brand,line,sku,code,product,variant) => ({
  name,color,finish,brand,line,sku,code,catalog:true,
  source:`https://mudhole.com/products/${product}?variant=${variant}`
 });
 const cobalt=thread('455 Cobalt','#131b8e','regular','ProWrap','ColorFast','CFS-D-455','455','prowrap-colorfast-rod-winding-thread-size-d-100-yds','34440571224197');
 const ice=thread('908 Ice Blue','#066c94','metallic','Fuji','Ultra Poly Metallic','MTD00-908','908','fuji-ultra-poly-metallic-rod-building-thread-100m-spool','34424465588357');
 const aqua=thread('910 Aqua','#1c998c','metallic','Fuji','Ultra Poly Metallic','MTD00-910','910','fuji-ultra-poly-metallic-rod-building-thread-100m-spool','34424465817733');
 const green=thread('552 Neon Green','#a8fc12','neon','ProWrap','Nylon','RNS-D-552','552','prowrap-nylon-rod-winding-thread-size-d-100-yds','34440557592709');
 const silver=thread('903 Silver','#94918a','metallic','Fuji','Ultra Poly Metallic','MTD00-903','903','fuji-ultra-poly-metallic-rod-building-thread-100m-spool','34424465424517');
 const black=thread('001 Black','#2c2c2e','regular','Fuji','Ultra Poly NOCP','NPD00-001','001','fuji-ultra-poly-nocp-rod-building-thread-100m-spool','34480389947525');
 const night=thread('860 Night Shade','#0d0a0b','regular','ProWrap','ColorFast','CFS-D-860','860','prowrap-colorfast-rod-winding-thread-size-d-100-yds','39338771153029');
 const teal=thread('017 Teal','#01baa6','regular','Fuji','Ultra Poly NOCP','NPD00-017','017','fuji-ultra-poly-nocp-rod-building-thread-100m-spool','34480390471813');
 const white=thread('002 White','#e2e1de','regular','Fuji','Ultra Poly NOCP','NPD00-002','002','fuji-ultra-poly-nocp-rod-building-thread-100m-spool','34480389980293');
 const nylon=(name,color,finish,code,variant)=>thread(name,color,finish,'ProWrap','Nylon',`RNS-D-${code}`,code,'prowrap-nylon-rod-winding-thread-size-d-100-yds',variant);
 // Photo-inspired preview colors; actual neon colors depend on thread and lighting.
 const cyan=nylon('434 Maui Surf','#24bed1','regular','434','34440557002885');
 const pink=nylon('361 Neon Pink','#fa0070','neon','361','34440556707973');
 const bubblegum=nylon('301 Bubblegum','#ff86b3','regular','301','34440556380293');
 const orange=nylon('225 Neon Orange','#ff8a16','neon','225','34440556347525');
 const red=nylon('325 Fire Red','#bf1235','regular','325','34440556544133');
 const yellow=nylon('122 Neon Yellow','#e9fa20','neon','122','34440556183685');
 const dark=nylon('862 Twilight Black','#16151a','regular','862','34440558674053');
 const trimWhite=nylon('807 White','#e8e7e2','regular','807','34440558379141');
 const ghostGrey=nylon('819 Ghost Grey','#999a98','regular','819','34440558444677');
 const solid=(t,turns)=>({...t,turns});
 // Symmetric 26-thread-width fades: gradually trade solid turns for paired
 // turns, then back again. Avoid a long, visibly striped 50/50 plateau.
 const fade=(from,to)=>[
  solid(from,4),spiral(from,to,1,undefined,1),
  solid(from,2),spiral(from,to,1,undefined,2),solid(from,1),
  solid(to,1),spiral(from,to,1,undefined,2),solid(to,2),
  spiral(from,to,1,undefined,1),solid(to,4)
 ];
 const pinkTrim=()=>[solid(white,1),solid(green,1),solid(pink,18),solid(green,1),solid(white,1)];
 // Resize by axial thread-widths: paired spiral turns cover twice a solid turn.
 const toLength=(design,length)=>{
  const target=Math.round(length/design.coverage);
  const total=design.bands.reduce((sum,b)=>sum+b.turns*(b.wrap==='spiral'?2:1),0);
  const scaled=design.bands.map((b,index)=>{
   const turns=b.turns*target/total;
   return {index,strands:b.wrap==='spiral'?2:1,turns:Math.floor(turns),fraction:turns-Math.floor(turns)};
  });
  let remainder=target-scaled.reduce((sum,b)=>sum+b.turns*b.strands,0);
  const ranked=scaled.slice().sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
  for(const b of ranked){
   if(b.strands<=remainder){b.turns++;remainder-=b.strands;}
   if(!remainder)break;
  }
  return {...design,bands:design.bands.map((b,index)=>({...b,turns:scaled[index].turns}))};
 };
 // Consolidate only identical solid threads; paired wraps stay separate.
 const combineSolids=design=>{
  const bands=[];
  for(const band of design.bands){
   const previous=bands.at(-1);
   const {turns,...thread}=band;
   const {turns:previousTurns,...previousThread}=previous||{};
   if(previous&&!previous.wrap&&!band.wrap&&
      JSON.stringify(thread)===JSON.stringify(previousThread)&&previousTurns+turns<=1000){
    previous.turns+=turns;
   }else bands.push({...band});
  }
  return {...design,bands};
 };
 const spiral=(first,second,direction,secondaryTurns,turns=8)=>({...first,turns,wrap:'spiral',direction,secondary:{...second,...(secondaryTurns?{turns:secondaryTurns}:{})}});
 return [{version:1,name:'Dorado',coverage:0.25,diameter:15,blank:'#101314',texture:false,bands:[
  solid(cobalt,16),spiral(cobalt,ice,1,15),solid(ice,16),
  spiral(ice,aqua,1,15),solid(aqua,16),spiral(aqua,green,1,110),
  solid(green,220),spiral(green,aqua,-1),solid(aqua,16),
  spiral(aqua,ice,-1),solid(ice,16),spiral(ice,cobalt,-1),solid(cobalt,16)
 ]},
 {version:1,name:'Aqua Shade',coverage:0.25,diameter:15,blank:'#101314',texture:true,bands:[
  solid(aqua,16),solid(night,150),solid(silver,4),solid(black,3),
  solid(silver,4),solid(night,150),solid(aqua,16)
 ]},
 {version:1,name:'Calstar Grafighter',coverage:0.25,diameter:15,blank:'#101314',texture:true,bands:[
  solid(black,10),spiral(black,teal,1,10,4),solid(teal,10),
  spiral(teal,white,1,10,4),solid(white,10),solid(black,150),
  spiral(black,teal,1,1,3),solid(black,150),solid(white,10),
  spiral(white,teal,-1,undefined,4),solid(teal,10),
  spiral(teal,black,-1,undefined,4),solid(black,10)
 ]},
 combineSolids(toLength({version:1,name:'Zarape',coverage:0.25,diameter:15,blank:'#101314',texture:true,bands:[
  // Read the reference image top to bottom as left-to-right wrapping order.
  solid(pink,1),solid(dark,4),...fade(dark,cyan),solid(cyan,7),
  solid(white,1),solid(yellow,3),solid(green,5),...fade(green,dark),solid(dark,5),
  ...pinkTrim(),solid(dark,5),...fade(dark,pink),solid(pink,3),
  ...fade(pink,bubblegum),solid(bubblegum,2),solid(yellow,1),solid(orange,6),
  ...fade(orange,red),solid(red,3),...fade(red,dark),solid(dark,4),
  ...pinkTrim(),solid(dark,5),...fade(dark,cyan),solid(cyan,9)
 ]},250)),
 {version:1,name:'Shadow Fade',coverage:0.25,diameter:15,blank:'#101314',texture:true,bands:[
  // Trade one black turn for one grey turn per block, retaining white inlays.
  ...Array.from({length:12},(_,i)=>[
   solid(dark,12-i),solid(trimWhite,1),solid(ghostGrey,i+1),solid(trimWhite,1)
  ]).flat(),
  // Fully grey endpoint: no zero-turn black band or doubled white trim.
  solid(ghostGrey,13)
 ]}];
})();
