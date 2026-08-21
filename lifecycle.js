export function createLifecycle({render,hasActive,registerServiceWorker}){
  let timer=0, generation=0, resetTimer=0, lastResume=0, initializedAt=Date.now();
  const stop=()=>{generation+=1;clearTimeout(timer);timer=0};
  const schedule=()=>{if(!hasActive()){stop();return}const own=++generation;const delay=Math.max(80,60000-(Date.now()%60000));clearTimeout(timer);timer=setTimeout(()=>{if(own!==generation)return;render();schedule()},delay)};
  const sync=()=>schedule();
  const resume=event=>{if(document.hidden)return;if(Date.now()<initializedAt+3000&&!(event?.type==='pageshow'&&event.persisted))return;if(Date.now()-lastResume<800)return;lastResume=Date.now();render();schedule()};
  const nextReset=()=>{clearTimeout(resetTimer);const now=new Date();const next=new Date(now);next.setHours(1,0,1,0);if(next<=now)next.setDate(next.getDate()+1);const game=new Date(now);game.setHours(5,0,1,0);if(game<=now)game.setDate(game.getDate()+1);if(game<next)next.setTime(game);resetTimer=setTimeout(()=>{render();nextReset()},Math.max(1000,next-now))};
  const start=()=>{schedule();nextReset();const deferred=()=>registerServiceWorker?.();if('requestIdleCallback'in window)requestIdleCallback(deferred,{timeout:1800});else setTimeout(deferred,700);document.addEventListener('visibilitychange',()=>{if(document.hidden){lastResume=0;return}resume()});document.addEventListener('resume',resume);window.addEventListener('pageshow',resume);window.addEventListener('focus',resume)};
  return {start,sync,stop};
}
