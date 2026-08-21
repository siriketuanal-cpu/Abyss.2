import {ABYSS_COUNT,IDLE_LEAD_MS,STAM_INTERVAL,maxForRank} from './constants.js';
import {clock,duration,idleInfo,settle,commitSettle} from './time.js';
import {$,setText,setValue,setClass,toggle,longPress} from './dom.js';

const group=index=>`group-${Math.floor(index/2)}`;
const editInput=(input,onCommit,onCancel)=>{
  input.readOnly=false;input.tabIndex=0;
  const opened=performance.now();
  input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();onCommit(input.value)}if(event.key==='Escape'){event.preventDefault();onCancel()}};
  input.onblur=()=>{if(performance.now()-opened>=180)onCommit(input.value)};
  setTimeout(()=>{input.focus({preventScroll:true});input.select()},0);
};

export function createAbyss({state,ui,commit,renderAll}){
  const root=$('#abyss-grid');
  const refs=[];
  const syncIdleConfirmBackdrop=()=>{
    const backdrop=$('#backdrop');
    if(!backdrop)return;
    const hasEdit=Boolean(ui.stamEdit||ui.gEdit||ui.slEdit);
    backdrop.classList.toggle('show',hasEdit);
    backdrop.classList.toggle('idle-confirm',!hasEdit&&ui.armedIdle!=null);
  };
  const disarmIdle=({redraw=true}={})=>{
    if(ui.armedIdle==null)return false;
    ui.armedIdle=null;
    ui.quickIdle={index:-1,at:0};
    syncIdleConfirmBackdrop();
    if(redraw)renderAll();
    return true;
  };
  const beginStamina=(slot,current)=>{
    slot.stamCurrent=Math.max(0,Math.min(slot.stamMax,Number(current)||0));
    slot.stamStart=Date.now();
    slot.stamRunning=slot.stamCurrent<slot.stamMax;
  };
  function info(slot,now){
    const stam=settle({current:slot.stamCurrent,start:slot.stamStart,running:slot.stamRunning},slot.stamMax,STAM_INTERVAL,now);
    return {stam,current:stam.current,fullAt:stam.fullAt,idle:idleInfo(slot,now)};
  }
  function hydrate(slot){
    const temp={current:slot.stamCurrent,start:slot.stamStart,running:slot.stamRunning};
    const result=commitSettle(temp,slot.stamMax,STAM_INTERVAL);
    slot.stamCurrent=temp.current;slot.stamStart=temp.start;slot.stamRunning=temp.running;
    return result;
  }
  function build(){
    let html='';
    for(let i=0;i<ABYSS_COUNT;i++){
      const slot=state.slots[i];
      html+=`<div class="abyss-row"><article class="card stam-card ${group(i)}" id="a-card-${i}" data-index="${i}"><div class="head"><span class="name" id="a-name-${i}">${slot.label||`スロット ${i+1}`}</span><input class="name-edit" id="a-name-edit-${i}" value="${slot.label}" aria-label="名前"><span class="rank" id="a-rank-${i}">Lv.${slot.rank}</span><input class="rank-edit" id="a-rank-edit-${i}" value="${slot.rank}" inputmode="numeric" aria-label="ランク"></div><div class="timer-label" id="a-plan-${i}"></div><div class="timer-main good" id="a-main-${i}">—:—</div><div class="number-row"><input id="a-current-${i}" readonly tabindex="-1" inputmode="numeric" aria-label="現在スタミナ"><span class="sep">/</span><span class="max" id="a-max-${i}"></span></div></article><article class="card idle-card ${group(i)}" id="a-idle-${i}" data-index="${i}"><span class="mark" id="a-daily-${i}">✔</span><span class="mark weekly" id="a-weekly-${i}">✦</span><div class="timer-label" id="a-idle-plan-${i}"></div><div class="timer-main idle" id="a-idle-main-${i}">—:—</div><div class="number-row" aria-hidden="true"></div></article></div>`;
    }
    root.innerHTML=html;
    for(let i=0;i<ABYSS_COUNT;i++){
      const card=$(`#a-card-${i}`),idle=$(`#a-idle-${i}`),current=$(`#a-current-${i}`),name=$(`#a-name-${i}`),rank=$(`#a-rank-${i}`);
      refs[i]={card,idle,current,name,rank,main:$(`#a-main-${i}`),plan:$(`#a-plan-${i}`),max:$(`#a-max-${i}`),idleMain:$(`#a-idle-main-${i}`),idlePlan:$(`#a-idle-plan-${i}`),daily:$(`#a-daily-${i}`),weekly:$(`#a-weekly-${i}`)};
      longPress(card,{onClick:()=>tapStam(i),onPress:()=>holdStam(i)});
      longPress(idle,{onClick:()=>tapIdle(i),onPress:()=>receiveIdle(i)});
      for(const child of [name,rank,current]){child.addEventListener('pointerdown',event=>event.stopPropagation());child.addEventListener('click',event=>event.stopPropagation())}
      longPress(name,{onClick:()=>tapStam(i),onPress:()=>editName(i)});
      longPress(rank,{onClick:()=>tapStam(i),onPress:()=>editRank(i)});
      current.addEventListener('blur',()=>{if(ui.stamEdit?.index===i&&ui.stamEdit.phase==='manual')commitManual(i,current.value)});
    }
  }
  function tapStam(i){
    if(disarmIdle())return;
    if(ui.stamEdit)return;
    const slot=state.slots[i],actual=hydrate(slot).current;
    ui.stamEdit={index:i,phase:'reference',value:Math.max(0,actual-40)};
    renderAll();
  }
  function holdStam(i){
    if(disarmIdle())return;
    const slot=state.slots[i];
    if(ui.stamEdit?.index===i&&ui.stamEdit.phase==='reference'){
      beginStamina(slot,ui.stamEdit.value);ui.stamEdit=null;commit();return;
    }
    if(ui.stamEdit)return;
    hydrate(slot);ui.stamEdit={index:i,phase:'manual',value:slot.stamCurrent};renderAll();
    editInput(refs[i].current,value=>commitManual(i,value),()=>cancelManual(i));
  }
  function commitManual(i,value){
    if(ui.stamEdit?.index!==i||ui.stamEdit.phase!=='manual')return;
    beginStamina(state.slots[i],value);ui.stamEdit=null;commit();
  }
  function cancelManual(i){if(ui.stamEdit?.index===i&&ui.stamEdit.phase==='manual'){ui.stamEdit=null;renderAll()}}
  function tapIdle(i){
    const now=Date.now();
    if(ui.armedIdle===i){
      if(now-ui.quickIdle.at<330&&ui.quickIdle.index===i){
        state.slots[i].weeklyDone=!state.slots[i].weeklyDone;
        ui.quickIdle={index:-1,at:0};
        commit();
        return;
      }
      ui.quickIdle={index:i,at:now};
      return;
    }
    if(ui.armedIdle!=null){disarmIdle();return;}
    ui.armedIdle=i;
    ui.quickIdle={index:i,at:now};
    syncIdleConfirmBackdrop();
    renderAll();
  }
  function receiveIdle(i){
    if(ui.armedIdle!==i)return;
    const slot=state.slots[i];
    // v227と同じく、受取後は5分経過した状態から次の12時間計測を開始する。
    slot.idleStart=Date.now()-IDLE_LEAD_MS;
    slot.idleRunning=true;
    slot.missionDone=true;
    disarmIdle({redraw:false});
    commit();
  }
  function editName(i){
    if(disarmIdle())return;
    const input=$(`#a-name-edit-${i}`);
    input.classList.add('editing');
    editInput(input,value=>{state.slots[i].label=value.trim();input.classList.remove('editing');commit()},()=>{input.classList.remove('editing');renderAll()});
  }
  function editRank(i){
    if(disarmIdle())return;
    const input=$(`#a-rank-edit-${i}`);
    input.classList.add('editing');
    editInput(input,value=>{const slot=state.slots[i];slot.rank=Math.max(1,Math.min(200,Math.floor(Number(value)||1)));slot.stamMax=maxForRank(slot.rank);slot.stamCurrent=Math.min(slot.stamCurrent,slot.stamMax);input.classList.remove('editing');commit()},()=>{input.classList.remove('editing');renderAll()});
  }
  function render(now=Date.now()){
    for(let i=0;i<ABYSS_COUNT;i++){
      const slot=state.slots[i],ref=refs[i];
      if(!ref)continue;
      const data=info(slot,now),editing=ui.stamEdit?.index===i?ui.stamEdit:null;
      const current=editing?editing.value:data.current;
      setText(ref.name,slot.label||`スロット ${i+1}`);setText(ref.rank,`Lv.${slot.rank}`);
      setText(ref.main,data.stam.full?clock(data.stam.fullAt):slot.stamRunning?duration(data.stam.remaining):'—:—');
      setClass(ref.main,`timer-main ${data.stam.full?'full reached':'good'}`);
      setText(ref.plan,editing?.phase==='reference'?'確定':slot.stamRunning&&!data.stam.full?clock(data.stam.fullAt):'');
      toggle(ref.plan,'await',editing?.phase==='reference');
      toggle(ref.card,'stam-preview',editing?.phase==='reference');
      setValue(ref.current,current);ref.current.readOnly=editing?.phase!=='manual';ref.current.tabIndex=editing?.phase==='manual'?0:-1;setText(ref.max,slot.stamMax);
      const armed=ui.armedIdle===i;
      setText(ref.idleMain,data.idle.full?clock(data.idle.end):data.idle.display);
      setClass(ref.idleMain,`timer-main ${data.idle.full?'full reached':'idle'}`);
      setText(ref.idlePlan,armed?'受取':data.idle.plan);toggle(ref.idlePlan,'await',armed);toggle(ref.idle,'armed',armed);
      toggle(ref.daily,'show',slot.missionDone);toggle(ref.weekly,'show',slot.weeklyDone);
    }
    syncIdleConfirmBackdrop();
  }
  function active(){return state.slots.some(slot=>slot.stamRunning||slot.idleRunning)}
  return {build,render,active,disarmIdle,syncIdleConfirmBackdrop};
}
