'use strict';
/* ---------- Graphiques interactifs : tactile, souris, clavier, lecteur d'écran ---------- */
let _chartSeq=0;const _charts=new Map();
const _chartFmt=(v,kind)=>kind==='pct'?(+v||0).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %':eur(v);
function _chartDetail(c,i){const p=c.points[i];if(!p)return'';const rows=[...c.series,...(c.lineSeries||[])].map(s=>`<span class="ichart-val"><i style="background:${s.color}"></i>${esc(s.name)} : <b>${_chartFmt(p.values[s.key],s.kind)}</b></span>`).join('');
  return `<b>${esc(p.label)}</b>${rows}${p.detail?`<span class="ichart-note">${esc(p.detail)}</span>`:''}`}
function _chartSelect(id,i,focusRange=false){const c=_charts.get(id);if(!c)return;i=Math.max(0,Math.min(c.points.length-1,i));c.index=i;
  document.querySelectorAll(`[data-chart="${id}"]`).forEach(fig=>{const out=fig.querySelector('.ichart-detail');if(out)out.innerHTML=_chartDetail(c,i);
    const range=fig.querySelector('.chart-range');if(range&&+range.value!==i)range.value=i;
    const svg=fig.querySelector('svg'),p=c.points[i];if(svg&&p){const cross=svg.querySelector('.ichart-cross'),dot=svg.querySelector('.ichart-dot');
      if(cross){cross.setAttribute('x1',p._x);cross.setAttribute('x2',p._x);cross.style.opacity=1}
      if(dot){const s=c.series[0],v=p.values[s.key];dot.setAttribute('cx',p._x);dot.setAttribute('cy',p._y(v));dot.style.opacity=1}
      fig.querySelectorAll('.ichart-bar').forEach((b,j)=>b.classList.toggle('sel',j===i));}
    if(focusRange)fig.querySelector('.chart-range')?.focus()});
  try{navigator.vibrate&&navigator.vibrate(8)}catch{}}
function interactiveChart(o){const id='chart-'+(++_chartSeq),points=o.points||[],series=o.series||[];if(!points.length||!series.length)return'';
  const W=360,H=o.height||190,padL=10,padR=10,padT=14,padB=30,iw=W-padL-padR,ih=H-padT-padB;
  let max=o.max;if(max==null){max=1;points.forEach(p=>series.forEach(s=>{max=Math.max(max,o.type==='bars'?series.reduce((t,x)=>t+Math.max(0,+p.values[x.key]||0),0):+p.values[s.key]||0)}))}
  if(o.lineSeries)points.forEach(p=>{max=Math.max(max,...o.lineSeries.map(s=>+p.values[s.key]||0))});
  const X=i=>points.length===1?padL+iw/2:padL+i*iw/(points.length-1),Y=v=>padT+ih-Math.max(0,+v||0)/max*ih;
  points.forEach((p,i)=>{p._x=X(i);p._y=Y});
  const grid=[0,.5,1].map(f=>{const y=padT+ih*f;return `<line x1="${padL}" x2="${W-padR}" y1="${y}" y2="${y}" class="ichart-grid"/><text x="${padL}" y="${Math.max(9,y-3)}" class="ichart-axis">${_chartFmt(max*(1-f),series[0].kind)}</text>`}).join('');
  let body='';
  if(o.type==='bars'){const slot=iw/Math.max(1,points.length),bw=Math.min(54,Math.max(8,slot*.62));
    body=points.map((p,i)=>{let y0=Y(0);const rects=series.map(s=>{const v=Math.max(0,+p.values[s.key]||0),h=v/max*ih,y=y0-h;y0=y;return `<rect class="ichart-seg" x="${(p._x-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" fill="${s.color}"/>`}).join('');
      return `<g class="ichart-bar${i===points.length-1?' sel':''}">${rects}<rect class="ichart-hit" x="${(p._x-slot/2).toFixed(1)}" y="${padT}" width="${slot}" height="${ih}"/></g>`}).join('')}
  else{const areaS=series[0];body=series.map(s=>{const d=points.map((p,i)=>`${i?'L':'M'}${p._x.toFixed(1)},${Y(p.values[s.key]).toFixed(1)}`).join('');
      return `${s===areaS&&o.area!==false?`<path d="${d} L${points[points.length-1]._x},${Y(0)} L${points[0]._x},${Y(0)}Z" fill="${s.color}" opacity=".14"/>`:''}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`}).join('')}
  if(o.lineSeries)body+=o.lineSeries.map(s=>`<path d="${points.map((p,i)=>`${i?'L':'M'}${p._x.toFixed(1)},${Y(p.values[s.key]).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-dasharray="${s.dash||''}" stroke-linejoin="round"/>`).join('');
  const labels=points.map((p,i)=>i===0||i===points.length-1||i===Math.floor((points.length-1)/2)?`<text x="${p._x}" y="${H-8}" text-anchor="middle" class="ichart-axis">${esc(p.short||p.label)}</text>`:'').join('');
  const c={points,series,lineSeries:o.lineSeries||[],index:points.length-1};_charts.set(id,c);if(_charts.size>80)_charts.delete(_charts.keys().next().value);
  const table=`<table class="ichart-table"><caption class="sr-only">Données : ${esc(o.title||'graphique')}</caption><thead><tr><th scope="col">Point</th>${[...series,...(o.lineSeries||[])].map(s=>`<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${points.map(p=>`<tr><th scope="row">${esc(p.label)}</th>${[...series,...(o.lineSeries||[])].map(s=>`<td>${_chartFmt(p.values[s.key],s.kind)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<figure class="ichart" data-chart="${id}"><figcaption class="sr-only">${esc(o.title||'Graphique interactif')}</figcaption>
   <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.aria||o.title||'Graphique')} Utilisez le curseur sous le graphique pour explorer chaque point.">${grid}${body}<line class="ichart-cross" y1="${padT}" y2="${padT+ih}" x1="${points[points.length-1]._x}" x2="${points[points.length-1]._x}"/><circle class="ichart-dot" r="5" cx="${points[points.length-1]._x}" cy="${points[points.length-1]._y(points[points.length-1].values[series[0].key])}"/>${labels}</svg>
   <div class="ichart-detail" aria-live="polite">${_chartDetail(c,c.index)}</div>
   <label class="ichart-range-l"><span class="sr-only">Choisir un point du graphique ${esc(o.title||'')}</span><input type="range" class="chart-range" min="0" max="${points.length-1}" step="1" value="${points.length-1}" aria-label="Point du graphique"></label>
   <div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}${(o.lineSeries||[]).map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>
   <details class="ichart-data"><summary>Données du graphique</summary><div class="ichart-scroll" tabindex="0" role="region" aria-label="Tableau des données">${table}</div></details></figure>`}
function _chartNearest(fig,ev){const c=_charts.get(fig.dataset.chart);if(!c)return -1;const svg=fig.querySelector('svg'),r=svg.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*360;
  let best=0,bd=1e9;c.points.forEach((p,i)=>{const d=Math.abs(p._x-x);if(d<bd){bd=d;best=i}});return best}
document.addEventListener('input',e=>{const r=e.target.closest('.chart-range');if(r)_chartSelect(r.closest('[data-chart]').dataset.chart,+r.value)});
document.addEventListener('keydown',e=>{const r=e.target.closest('.chart-range');if(!r)return;const id=r.closest('[data-chart]').dataset.chart,c=_charts.get(id);if(!c)return;
  if(e.key==='Home'){e.preventDefault();_chartSelect(id,0)}if(e.key==='End'){e.preventDefault();_chartSelect(id,c.points.length-1)}});
document.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const fig=e.target.closest&&e.target.closest('[data-chart]');if(!fig||!e.target.closest('svg'))return;const i=_chartNearest(fig,e);if(i>=0)_chartSelect(fig.dataset.chart,i)});
document.addEventListener('pointerdown',e=>{const fig=e.target.closest&&e.target.closest('[data-chart]');if(!fig||!e.target.closest('svg'))return;const id=fig.dataset.chart,i=_chartNearest(fig,e);if(i<0)return;
  let moved=false;const move=ev=>{if(Math.abs(ev.clientX-e.clientX)+Math.abs(ev.clientY-e.clientY)>12)moved=true;if(moved)_chartSelect(id,_chartNearest(fig,ev))};
  const timer=setTimeout(()=>{_chartSelect(id,i)},e.pointerType==='mouse'?0:300);
  const up=()=>{clearTimeout(timer);if(e.pointerType==='mouse'||!moved)_chartSelect(id,_chartNearest(fig,e.changedTouches?e:e));document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up)};
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)},{passive:true});
/* Donut catégories interactif */
document.addEventListener('click',e=>{const b=e.target.closest('[data-donut]');if(!b)return;const fig=b.closest('[data-donut-chart]');if(!fig)return;
  fig.querySelectorAll('[data-donut]').forEach(x=>{const on=x===b;x.classList.toggle('sel',on);x.setAttribute('aria-pressed',on)});
  const out=fig.querySelector('.donut-detail');if(out)out.innerHTML=`<b>${esc(b.dataset.name)}</b><span>${eur(+b.dataset.value)} · ${b.dataset.pct} % du total</span>`;
  fig.querySelectorAll('.donut-seg').forEach(s=>s.classList.toggle('dim',s.dataset.name!==b.dataset.name));try{navigator.vibrate&&navigator.vibrate(8)}catch{}});
