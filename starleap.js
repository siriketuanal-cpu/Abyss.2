import {SL_STAM_INTERVAL,SL_STAM_MAX,SL_ORB_INTERVAL,SL_ORB_MAX} from './constants.js';
import {clock,duration,settle,commitSettle,startTimer} from './time.js';
import {$,setText,setValue,setClass} from './dom.js';

export function createStarleap({state,ui,commit,renderAll}){
  const root=$('#sl-grid');
  let refs={};
  function build(){
    root.innerHTML=`<article class="plain-card" id="sl-stamina"><span class="plain-name">討伐依頼</span><div class="plain-main" id="sl-stam-main">—:—</div><div class="plain-sub"><input id="sl-current" readonly tabindex="-1" inputmode="numeric"><span class="sep">/</span><input id="sl-max" readonly tabindex="-1"></div></article><article class="plain-card" id="sl-orb"><span class="plain-name">御大樹の恵み</span><div class="plain-main orb-main" id="sl-orb-main">○○○○</div><div class="plain-sub orb-sub" id="sl-orb-sub"></div></article>`;
    refs={card:$('#sl-stamina'),current:$('#sl-current'),max:$('#sl-max'),main:$('#sl-stam-main'),orbMain:$('#sl-orb-main'),orbSub:$('#sl-orb-sub')};
    let last=0;
    refs.card.addEventListener('click',()=>{if(Date.now()-last<300)edit();last=Date.now()});
    refs.current.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();finish(event.target.value)}if(event.key==='Escape'){ui.slEdit=null;renderAll()}});
    refs.current.addEventListener('blur',event=>finish(event.target.value));
  }
  function edit(){
    if(ui.slEdit)return;
    const timer=state.sl.stamina;
    const data=commitSettle(timer,SL_STAM_MAX,SL_STAM_INTERVAL);
    timer.current=data.current;
    ui.slEdit=true;
    renderAll();
    refs.current.readOnly=false;refs.current.tabIndex=0;
    setTimeout(()=>{refs.current.focus({preventScroll:true});refs.current.select()},0);
  }
  function finish(value){
    if(!ui.slEdit)return;
    const timer=state.sl.stamina;
    timer.current=Math.max(0,Math.min(SL_STAM_MAX,Number(value)||0));
    startTimer(timer,timer.current,SL_STAM_MAX,SL_STAM_INTERVAL);
    ui.slEdit=null;
    commit();
  }
  function render(now=Date.now()){
    const stam=settle(state.sl.stamina,SL_STAM_MAX,SL_STAM_INTERVAL,now);
    const orb=settle(state.sl.orb,SL_ORB_MAX,SL_ORB_INTERVAL,now);
    setText(refs.main,stam.full?clock(stam.fullAt):state.sl.stamina.running?duration(stam.remaining):'—:—');
    setClass(refs.main,`plain-main ${stam.full?'full reached':''}`);
    setValue(refs.current,stam.current);setValue(refs.max,SL_STAM_MAX);refs.current.readOnly=!ui.slEdit;refs.current.tabIndex=ui.slEdit?0:-1;
    setText(refs.orbMain,'●'.repeat(Math.min(SL_ORB_MAX,orb.current))+'○'.repeat(Math.max(0,SL_ORB_MAX-orb.current)));
    setClass(refs.orbMain,`plain-main orb-main ${orb.full?'orb-full':''}`);
    setText(refs.orbSub,orb.full?clock(orb.fullAt):state.sl.orb.running?`次 ${duration(orb.remaining)}`:`${orb.current}/${SL_ORB_MAX}　未開始`);
    setClass(refs.orbSub,`plain-sub orb-sub ${orb.full?'reached':''}`);
  }
  return {build,render,active:()=>state.sl.stamina.running||state.sl.orb.running};
}
