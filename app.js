import {load,save,resetDates} from './state.js';
import {ABYSS_COUNT,STORAGE_KEY} from './constants.js';
import {$,setText} from './dom.js';
import {createAbyss} from './abyss.js';
import {createGeneration} from './generation.js';
import {createStarleap} from './starleap.js';
import {createLifecycle} from './lifecycle.js';

const state=load();
const ui={stamEdit:null,gEdit:null,slEdit:null,armedIdle:null,quickIdle:{index:-1,at:0}};
let lifecycle;
const dateLabel=()=>{const [year,month,day]=state.dailyDate.split('-').map(Number);return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'long',day:'numeric'}).format(new Date(year,month-1,day))};
function renderProgress(){const progress=$('#daily-progress');let done=0;progress.innerHTML='';state.slots.forEach((slot,index)=>{const dot=document.createElement('span');dot.className=`daily-dot ${slot.missionDone?'done':''}`;dot.title=`スロット${index+1}`;progress.append(dot);if(slot.missionDone)done++});progress.setAttribute('aria-label',`デイリー進捗 ${done}/${ABYSS_COUNT}`)}
function render(){const reset=resetDates(state);if(reset)save(state);setText($('#game-date'),dateLabel());abyss.render();generation.render();starleap.render();renderProgress()}
function commit(){save(state);render();lifecycle?.sync()}
const abyss=createAbyss({state,ui,commit,renderAll:render});
const generation=createGeneration({state,ui,commit,renderAll:render});
const starleap=createStarleap({state,ui,commit,renderAll:render});
abyss.build();generation.build();starleap.build();render();
lifecycle=createLifecycle({render,hasActive:()=>abyss.active()||generation.active()||starleap.active(),registerServiceWorker:()=>{if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{})}});
lifecycle.start();
const dialog=$('#manage-dialog'),manageStatus=$('#manage-status');
const setManageStatus=message=>{manageStatus.textContent=message};
$('#manage-button').addEventListener('click',()=>{setManageStatus('');dialog.showModal()});
$('#manage-close').addEventListener('click',()=>dialog.close());
$('#export-button').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`deep-abyss-backup-${state.dailyDate}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setManageStatus('保存ファイルを作成しました。')});
$('#import-input').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.slots))throw new Error('invalid');if(!window.confirm('現在の保存を上書きして読み込みます。よろしいですか？')){event.target.value='';return}localStorage.setItem(STORAGE_KEY,JSON.stringify(parsed));location.reload()}catch{setManageStatus('読み込めない保存ファイルです。')}finally{event.target.value=''}});
$('#reset-button').addEventListener('click',()=>{if(!window.confirm('この端末の深淵タイマー保存を初期化します。よろしいですか？'))return;localStorage.removeItem(STORAGE_KEY);location.reload()});
$('#backdrop').addEventListener('click',()=>{abyss.disarmIdle()});
