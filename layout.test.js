'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');
const vm=require('node:vm');

function panelLayout(raw=null,blocked=false){
 const selectors=['#thread-catalog','.scale-settings','.starting-points','.color-workspace','.thread-design'];
 const panels=Object.fromEntries(selectors.map((selector,i)=>[selector,{open:i>=3,addEventListener(type,fn){this[type]=fn;}}]));
 const listeners={},storage=new Map(raw===null?[]:[['rodloom-layout-v1',raw]]);
 vm.runInNewContext(fs.readFileSync('layout.js','utf8'),{
  document:{querySelector:selector=>panels[selector]},
  window:{addEventListener:(type,fn)=>{listeners[type]=fn;}},
  localStorage:{getItem:key=>{if(blocked)throw Error('Blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(blocked)throw Error('Blocked');storage.set(key,value);}}
 });
 return {panels,listeners,storage};
}

test('catalog defaults to collapsed and layout restores all panels from the last session',()=>{
 assert.ok(html.includes('class="palette-lookup" data-auto-gray="true"><summary>'));
 assert.ok(html.indexOf('<script src="layout.js">')<html.indexOf('<script src="app.js">'));
 const {panels,storage,listeners}=panelLayout();
 assert.equal(panels['#thread-catalog'].open,false);
 panels['#thread-catalog'].open=true;panels['#thread-catalog'].toggle();
 panels['.starting-points'].open=true;
 panels['.thread-design'].open=false;
 listeners.pagehide();
 const restored=panelLayout(storage.get('rodloom-layout-v1')).panels;
 for(const selector of Object.keys(panels))assert.equal(restored[selector].open,panels[selector].open);
});

test('invalid or unavailable layout storage preserves defaults and does not break toggles',()=>{
 for(const raw of ['{','null','{"version":2,"panels":{"catalog":true}}','{"version":1,"panels":{"catalog":"true"}}']){
  const {panels}=panelLayout(raw);
  assert.equal(panels['#thread-catalog'].open,false);
  assert.equal(panels['.thread-design'].open,true);
 }
 const {panels,listeners}=panelLayout(null,true);
 assert.doesNotThrow(()=>panels['#thread-catalog'].toggle());
 assert.doesNotThrow(()=>listeners.pagehide());
});

test('Thread bands heading precedes the design controls within its accordion',()=>{
 assert.ok(html.includes('<aside class="editor" aria-label="Design editor"><details class="thread-design" open><summary>Thread bands</summary><div class="design-name-row">'));
 assert.equal((html.match(/<details class="thread-design"/g)||[]).length,1);
});

test('Design colors is a native accordion that shares remaining desktop height',()=>{
 assert.ok(html.includes('<details class="color-workspace" aria-label="Color workspace" open>'));
 assert.ok(html.includes('<summary class="dock-heading">'));
 assert.ok(html.includes('<div class="color-workspace-body">'));
 assert.ok(css.includes('.color-workspace[open]{flex:1 1 0;overflow-y:auto;scrollbar-gutter:stable}'));
 assert.ok(!css.includes('height:288px'));
 assert.ok(css.includes('.color-workspace:not([open])>.color-workspace-body{display:none}'));
});

test('Design colors owns overflow scrolling rather than a nested palette scrollbar',()=>{
 assert.ok(css.includes('.color-workspace-body{display:flex;flex-direction:column;min-height:0}'));
 assert.ok(css.includes('.color-workspace [role=tabpanel]{min-height:0;overflow:visible}'));
 assert.ok(!css.includes('height:248px'));
});

test('library and bands share remaining desktop space only when expanded',()=>{
 assert.ok(css.includes('.starting-points{flex:0 0 auto;min-height:34px;overflow-y:auto}'));
 assert.ok(css.includes('.starting-points[open]{flex:1 1 0}'));
 assert.ok(css.includes('.editor{flex:0 0 auto;min-height:34px;padding-bottom:0;overflow-y:auto;scrollbar-gutter:stable}'));
 assert.ok(css.includes('.editor:has(.thread-design[open]){flex:1 1 0;padding-bottom:10px}'));
 assert.ok(!css.includes('max-height:28%'));
});

test('collapsed headings have no inner divider or bottom padding at any viewport',()=>{
 const base=css.slice(0,css.indexOf('@media screen and (min-width:901px)'));
 assert.ok(base.includes('.palette-lookup{padding:0 10px}'));
 assert.ok(base.includes('.starting-points{padding:0 10px;margin-bottom:8px}'));
 assert.ok(base.includes('.editor{padding:0 10px}'));
 assert.ok(base.includes('.palette-lookup>summary,.starting-points>summary,.thread-design>summary,.color-workspace>.dock-heading{min-height:38px;border-bottom:0}'));
 assert.ok(base.includes('.palette-lookup[open]>summary,.starting-points[open]>summary,.thread-design[open]>summary,.color-workspace[open]>.dock-heading{border-bottom:1px solid var(--line)}'));
 assert.ok(!css.includes('margin:-8px -10px'));
});

test('design library fills available width with responsive columns and automatic rows',()=>{
 assert.ok(css.includes('grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));grid-auto-rows:auto'));
 assert.ok(css.includes('.library-entry{position:relative;display:flex;min-width:0;width:100%}'));
 assert.ok(!/\.library-entry\{[^}]*max-width:/.test(css));
 assert.ok(css.includes('.preset{width:100%;'));
});

test('mobile library cards fill the available width in one column',()=>{
 assert.match(css,/@media\(max-width:540px\)\{\s+\/\*[^]*?\*\/\s+#presets\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('palette and catalog action buttons have compact edge clearance without doubled row padding',()=>{
 assert.ok(css.includes('--control-inset:3px;'));
 assert.match(css,/\.saved-color\{[^}]*padding:var\(--control-inset\)/);
 assert.match(css,/\.saved-color-choice\{[^}]*padding:0 4px/);
 assert.match(css,/\.catalog-actions\{[^}]*padding:var\(--control-inset\)/);
 assert.ok(css.includes('.saved-color>button:focus-visible,.catalog-actions>button:focus-visible{outline-offset:1px}'));
});

test('all collapsible headings share one disclosure icon and spacing',()=>{
 assert.match(css,/summary\{[^}]*gap:6px;[^}]*list-style:none/);
 assert.ok(css.includes('summary::-webkit-details-marker{display:none}'));
 assert.match(css,/summary::before\{[^}]*flex:0 0 8px;[^}]*height:8px;[^}]*clip-path:/);
 assert.match(css,/details\[open\]>summary::before\{clip-path:/);
 assert.ok(!css.includes('.dock-heading::before'));
 assert.match(css,/\.dock-heading\{[^}]*gap:6px/);
});

test('desktop accordion headings stay pinned like Thread catalog',()=>{
 assert.ok(css.includes('.palette-lookup>summary,.starting-points>summary,.thread-design>summary{position:sticky;top:0;z-index:2;background:var(--white)}'));
 assert.ok(css.includes('.dock-heading{position:sticky;top:0;z-index:2}'));
 assert.ok(css.includes('.dock-heading,.design-swatches,.palette-tabs,.color-storage-status{flex-shrink:0}'));
});
