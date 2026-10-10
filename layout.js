'use strict';
// Panel layout belongs to the browser, not to a design or its undo history.
(() => {
 const key='rodloom-layout-v1';
 const selectors={catalog:'#thread-catalog',calibration:'.scale-settings',library:'.starting-points',colors:'.color-workspace',bands:'.thread-design'};
 const panels=Object.entries(selectors).map(([name,selector])=>[name,document.querySelector(selector)]).filter(([,panel])=>panel);
 let saved;
 try{saved=JSON.parse(localStorage.getItem(key));}catch{}
 if(saved&&saved.version===1&&saved.panels&&typeof saved.panels==='object'){
  for(const [name,panel] of panels)if(typeof saved.panels[name]==='boolean')panel.open=saved.panels[name];
 }
 function save(){
  try{localStorage.setItem(key,JSON.stringify({version:1,panels:Object.fromEntries(panels.map(([name,panel])=>[name,panel.open]))}));}catch{}
 }
 for(const [,panel] of panels)panel.addEventListener('toggle',save);
 // Also capture programmatic reveals even if the final toggle is still queued.
 window.addEventListener('pagehide',save);
})();
