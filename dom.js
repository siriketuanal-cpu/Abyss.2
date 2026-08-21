export const $=(selector,root=document)=>root.querySelector(selector);
export const setText=(node,value)=>{const text=String(value??'');if(node&&node.textContent!==text)node.textContent=text};
export const setValue=(node,value)=>{const text=String(value??'');if(node&&node.value!==text)node.value=text};
export const setClass=(node,value)=>{if(node&&node.className!==value)node.className=value};
export const toggle=(node,name,value)=>node?.classList.toggle(name,Boolean(value));
export function longPress(target,{onPress,onClick,delay=520}){let timer=0;let held=false;let started=0;const clear=()=>{clearTimeout(timer);timer=0};target.addEventListener('pointerdown',event=>{held=false;started=performance.now();clear();timer=setTimeout(()=>{held=true;timer=0},delay)});target.addEventListener('pointerup',event=>{const isLong=Boolean(started)&&(held||performance.now()-started>=delay);clear();started=0;if(isLong){held=true;onPress?.(event)}});target.addEventListener('pointercancel',()=>{clear();started=0;held=false});target.addEventListener('click',event=>{if(held){event.preventDefault();event.stopPropagation();held=false;return}onClick?.(event)});}
