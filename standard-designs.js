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
 const solid=(t,turns)=>({...t,turns});
 const spiral=(first,second,direction,secondaryTurns,turns=8)=>({...first,turns,wrap:'spiral',direction,secondary:{...second,...(secondaryTurns?{turns:secondaryTurns}:{})}});
 return [{version:1,name:'Durado',coverage:0.25,diameter:15,blank:'#101314',texture:false,bands:[
  solid(cobalt,16),spiral(cobalt,ice,1,15),solid(ice,16),
  spiral(ice,aqua,1,15),solid(aqua,16),spiral(aqua,green,1,110),
  solid(green,110),solid(silver,4),solid(black,3),solid(silver,4),
  solid(green,110),spiral(green,aqua,-1),solid(aqua,16),
  spiral(aqua,ice,-1),solid(ice,16),spiral(ice,cobalt,-1),solid(cobalt,16)
 ]},
 {version:1,name:'Aqua Shade',coverage:0.25,diameter:15,blank:'#101314',texture:true,bands:[
  solid(aqua,16),solid(night,150),solid(silver,4),solid(black,3),
  solid(silver,4),solid(night,150),solid(aqua,16)
 ]},
 {version:1,name:'CalStar Grapfighter',coverage:0.25,diameter:15,blank:'#101314',texture:true,bands:[
  solid(black,10),spiral(black,teal,1,10,4),solid(teal,10),
  spiral(teal,white,1,10,4),solid(white,10),solid(black,150),
  spiral(black,teal,1,1,3),solid(black,150),solid(white,10),
  spiral(white,teal,-1,undefined,4),solid(teal,10),
  spiral(teal,black,-1,undefined,4),solid(black,10)
 ]},
 {version:1,name:'Durado no line',coverage:0.25,diameter:15,blank:'#101314',texture:false,bands:[
  solid(cobalt,16),spiral(cobalt,ice,1,15),solid(ice,16),
  spiral(ice,aqua,1,15),solid(aqua,16),spiral(aqua,green,1,110),
  solid(green,220),spiral(green,aqua,-1),solid(aqua,16),
  spiral(aqua,ice,-1),solid(ice,16),spiral(ice,cobalt,-1),solid(cobalt,16)
 ]}];
})();
