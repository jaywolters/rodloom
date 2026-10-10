// Reuse toolbar buttons so context actions always share their current behavior.
(() => {
 const editor=document.querySelector('.thread-design');
 const menu=document.createElement('div');
 menu.className='band-context-menu';menu.hidden=true;
 menu.setAttribute('role','menu');menu.setAttribute('aria-label','Band actions');
 document.body.append(menu);
 let returnFocus=null;
 function close(restore=false){
  if(menu.hidden)return;
  menu.hidden=true;
  if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
 }
 function items(){return [...menu.querySelectorAll('button:not(:disabled)')];}
 editor.addEventListener('contextmenu',event=>{
  // Keep native editing/copy menus for text fields.
  if(event.target.closest('input:not([type="checkbox"]),textarea,select'))return;
  event.preventDefault();
  const row=event.target.closest('.band');
  const checkbox=row?.querySelector('.select-band');
  const band=row?state.bands[Number(row.dataset.index)]:null;
  const strandArea=event.target.closest('.spiral-editor');
  const clickedThread=band?(band.wrap==='spiral'&&!strandArea?band.secondary:band):null;
  if(checkbox&&!checkbox.checked&&!row.querySelector('.select-outgoing')?.checked){
   if(band.wrap==='spiral'&&strandArea)selectSpiralStrand(band,'outgoing',true);
   else checkbox.click();
  }
  returnFocus=document.activeElement;
  menu.replaceChildren();
  for(const source of editor.querySelectorAll('.block-actions button')){
   const button=document.createElement('button');
   button.type='button';button.setAttribute('role','menuitem');
   button.disabled=source.disabled;
   const icon=source.querySelector('svg');
   if(icon)button.append(icon.cloneNode(true));
   const label=document.createElement('span');
   label.textContent=source.getAttribute('aria-label');button.append(label);
   button.title=source.title;
   button.onclick=()=>{
    close(true);
    if(source.id==='select-same-color'&&clickedThread)selectSameColor([clickedThread]);
    else source.click();
   };
   menu.append(button);
  }
  menu.hidden=false;
  const rect=menu.getBoundingClientRect();
  const anchor=event.target.getBoundingClientRect();
  const x=event.clientX||anchor.left,y=event.clientY||anchor.bottom;
  menu.style.left=`${Math.max(4,Math.min(x,innerWidth-rect.width-4))}px`;
  menu.style.top=`${Math.max(4,Math.min(y,innerHeight-rect.height-4))}px`;
  items()[0]?.focus({preventScroll:true});
 });
 menu.addEventListener('keydown',event=>{
  const enabled=items(),index=enabled.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();
   const next=event.key==='Home'?0:event.key==='End'?enabled.length-1:
    (index+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length;
   enabled[next]?.focus();
  }
 });
 document.addEventListener('keydown',event=>{
  if(menu.hidden)return;
  if(event.key==='Escape'){event.preventDefault();close(true);}
  else if(event.key==='Tab')close();
 });
 document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))close();});
 document.addEventListener('focusin',event=>{if(!menu.contains(event.target))close();});
 document.addEventListener('scroll',()=>close(),true);
 window.addEventListener('resize',()=>close());
})();
