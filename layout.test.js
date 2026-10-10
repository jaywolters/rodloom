'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('style.css','utf8');

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

test('desktop accordion headings stay pinned like Thread catalog',()=>{
 assert.ok(css.includes('.palette-lookup>summary,.starting-points>summary,.thread-design>summary{position:sticky;top:0;z-index:2;background:var(--white)}'));
 assert.ok(css.includes('.dock-heading{position:sticky;top:0;z-index:2}'));
 assert.ok(css.includes('.dock-heading,.design-swatches,.palette-tabs,.color-storage-status{flex-shrink:0}'));
});
