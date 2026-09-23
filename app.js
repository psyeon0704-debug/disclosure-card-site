'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {cards:[], prices:{}, sector:'', company:'', year:'', selected:null, limit:12};

function safeUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='dart.fss.or.kr'?u.href:null;}catch{return null;}}
const EXT='<svg class="ext" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3.5 2.5h6v6M9.5 2.5L2.8 9.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function sourceLink(link,label,cls){const url=safeUrl(link?.url);return url?'<a class="'+(cls||'source')+'" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label||link.title)+EXT+'</a>':'';}
const mmdd=d=>d.slice(5).replace('-','.');
const ymd=d=>d.replaceAll('-','.');

function listCards(){return state.cards.filter(c=>(!state.sector||c.sector===state.sector)&&(!state.company||c.corp_name===state.company)&&(!state.year||c.event_date.startsWith(state.year)));}

function renderList(){
 const list=listCards();
 $('#result-count').textContent='공시 '+list.length+'건';
 $('#signals').innerHTML=list.length?list.slice(0,state.limit).map(c=>{
  const on=c.event_key===state.selected;
  return '<button type="button" class="signal'+(on?' active':'')+'" data-key="'+esc(c.event_key)+'" aria-pressed="'+on+'">'+
   '<span class="signal-top"><strong>'+esc(c.corp_name)+'</strong><span class="signal-date">'+esc(mmdd(c.event_date))+'</span></span>'+
   '<span class="signal-type">'+esc(c.event_type)+'</span></button>';
 }).join(''):'<p class="empty-mini">조건에 맞는 공시가 없어요.</p>';
 $('#more').hidden=list.length<=state.limit;
 $('#more').textContent='공시 더 보기 ('+Math.min(state.limit,list.length)+' / '+list.length+')';
}

function filterChanged(){
 state.limit=12;const list=listCards();state.selected=list[0]?.event_key||null;renderList();
 if(list.length)renderDetail(list[0]);
 else{$('#detail').innerHTML='<div class="empty"><h2>조건에 맞는 공시가 없어요</h2><p>기업이나 연도를 바꾸어 다시 확인해 주세요.</p><button type="button" data-action="reset">전체 공시 보기</button></div>';$('#detail').setAttribute('aria-busy','false');}
}

function layer(num,title,inner){
 return '<section class="band layer"><div class="layer-label">'+(num?'<span class="layer-num">'+num+'</span>':'')+'<span class="layer-title">'+title+'</span></div><div class="layer-body">'+inner+'</div></section>';
}

function priceChart(c){
 const ser=state.prices[c.ticker];
 if(!Array.isArray(ser)||!ser.length)return '';
 const upto=ser.filter(r=>r[0]<=c.event_date);
 if(upto.length<12)return '';
 const win=upto.slice(-40);
 const n=win.length, vals=win.map(r=>r[1]);
 const min=Math.min(...vals), max=Math.max(...vals);
 const VW=1000, top=10, bot=188;
 const x=i=>n===1?VW:VW*i/(n-1);
 const y=v=>max===min?(top+bot)/2:top+(bot-top)*(1-(v-min)/(max-min));
 const line=win.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(r[1]).toFixed(1)).join(' ');
 const area=line+' L'+VW+' 199 L0 199 Z';
 const lastPct=(y(win[n-1][1])/200*100).toFixed(2);
 const price=win[n-1][1].toLocaleString('ko-KR');
 const aria='공시 전 '+n+'거래일 종가 흐름, '+ymd(win[0][0])+'부터 '+ymd(win[n-1][0])+'까지, 공시일 종가 '+price+'원';
 return '<section class="band chart-band">'+
  '<div class="chart-head"><div class="chart-title"><span class="chart-h">공시 전 주가 흐름</span><span class="chart-sub">공시일까지의 종가예요. 공시 이후 주가는 보여드리지 않아요.</span></div>'+
  '<div class="chart-price"><span class="chart-price-label">공시일 종가</span><span class="chart-price-num">'+esc(price)+'원</span></div></div>'+
  '<div class="chart-plot">'+
   '<svg viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label="'+esc(aria)+'">'+
    '<line x1="0" y1="199" x2="1000" y2="199" stroke="#e5e8eb" stroke-width="1" vector-effect="non-scaling-stroke"/>'+
    '<path d="'+area+'" fill="rgba(0,23,51,0.045)"/>'+
    '<path d="'+line+'" fill="none" stroke="#333d4b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'+
    '<line x1="1000" y1="0" x2="1000" y2="199" stroke="#b0b8c1" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>'+
   '</svg>'+
   '<span class="chart-dot" style="top:'+lastPct+'%"></span>'+
   '<span class="chart-flag">공시일</span>'+
  '</div>'+
  '<div class="chart-axis"><span>'+esc(ymd(win[0][0]))+'</span><span>최근 '+n+'거래일 종가 · 단위 원</span><span>'+esc(ymd(win[n-1][0]))+'</span></div>'+
 '</section>';
}

function reasonInner(c){
 const reason=c.layer2_reason;if(!reason)return '';
 const accounts=reason.accounts_plain||[], checkpoints=(reason.checkpoints_plain||[]).slice(0,4);
 const snapshot=c.presentation&&c.presentation.snapshot_date;
 let h='';
 if(accounts.length)h+='<div class="accounts"><span class="mini-label">함께 확인할 계정</span><div class="chips">'+accounts.map(a=>'<span class="chip">'+esc(a)+'</span>').join('')+'</div></div>';
 if(checkpoints.length)h+='<ol class="checks">'+checkpoints.map((p,i)=>'<li><span class="check-num">'+String(i+1).padStart(2,'0')+'</span><span class="check-text">'+esc(p)+'</span></li>').join('')+'</ol>';
 if(snapshot)h+='<p class="scope-note"><b>다른 보고서 기준 · '+esc(snapshot)+'</b><br>공시 이전 정기보고서에서 확인한 항목이에요. 이번 공시 때문에 생긴 내용이라는 뜻은 아니에요.</p>';
 if(reason.note)h+='<p class="reason-note">'+esc(reason.note)+'</p>';
 return h?layer('2층','이 공시,<br>뭘 봐야 하나요?',h):'';
}

function precedentInner(c){
 const p=c.layer3_precedent, view=c.presentation||{};
 if(!p||view.statistics_state!=='ok'){
  const review=view.statistics_state==='review';
  const inner='<p class="insuff-title">'+(review?'과거 사례 자료를 확인하고 있어요':'비슷한 사례가 부족해요')+'</p><p class="insuff-body">'+(review?'공시 당시 확인할 수 있었던 과거 결과인지 점검이 필요해, 통계와 사례표를 표시하지 않았어요.':'확인된 유사 사례가 10건 이상일 때만 통계와 사례표를 보여드려요.')+'</p>';
  return layer('3층','비슷한 상황이<br>과거에도 있었어요',inner);
 }
 const total=p.peer_count, neg=p.peer_negative, rest=Math.max(total-neg,0);
 const sign=v=>v==null?'neutral':(v>0.0001?'up':(v<-0.0001?'down':'neutral'));
 const rows=p.cases.map(it=>'<div class="cases-row"><span class="c-date num">'+esc(ymd(it.event_date))+'</span><span class="c-corp">'+esc(it.corp_name)+'</span><span class="c-type">'+esc(it.event_type)+'</span><span class="c-num num '+sign(it.pre_return_20d)+'">'+esc(it.pre_return_display)+'</span><span class="c-num num '+esc(it.mark)+'">'+esc(it.car_display)+'</span></div>').join('');
 const cards=p.cases.map(it=>'<div class="ccard"><div class="ccard-top"><span class="c-corp">'+esc(it.corp_name)+'</span><span class="c-date num">'+esc(ymd(it.event_date))+'</span></div><span class="c-type">'+esc(it.event_type)+'</span><div class="ccard-stats"><span class="cstat"><span class="cstat-l">직전 20거래일</span><span class="cstat-v num '+sign(it.pre_return_20d)+'">'+esc(it.pre_return_display)+'</span></span><span class="cstat"><span class="cstat-l">이후 20거래일 시장 대비</span><span class="cstat-v num '+esc(it.mark)+'">'+esc(it.car_display)+'</span></span></div></div>').join('');
 const mix=Object.entries(p.event_type_mix||{});
 let h='';
 h+='<p class="prec-intro">같은 '+esc(c.sector)+' 업종에서 비슷한 상황이었던 과거 '+esc(c.event_type)+' 공시를 모아봤어요.</p>';
 if(p.situation)h+='<p class="prec-situation">이번 공시는 <b>'+esc(p.situation)+'</b>에서 나왔어요.</p>';
 h+='<div class="dist">'+
  '<p class="dist-head">과거 <b class="num">'+total+'</b>건 중 <b class="num">'+neg+'</b>건은 이후 20거래일 주가가 시장 기준보다 <b class="num">3%p</b> 넘게 낮았어요</p>'+
  '<div class="ratio"><span class="ratio-neg" style="flex:'+neg+'"></span><span class="ratio-rest" style="flex:'+rest+'"></span></div>'+
  '<div class="dist-legend">'+
   '<span class="leg"><span class="sw down"></span>3%p 넘게 낮았어요 <b class="num">'+neg+'건</b></span>'+
   '<span class="leg"><span class="sw rest"></span>그렇지 않았어요 <b class="num">'+esc(view.non_negative_display||(rest+'건'))+'</b></span>'+
  '</div>'+
  '<p class="dist-note">과거에 일어난 일이고, 이번에도 그렇게 된다는 뜻은 아니에요. 시장 대비 성과는 코스피 흐름을 감안한 20거래일 누적값이에요.</p>'+
 '</div>';
 h+='<div class="cases-wrap"><div class="cases-cap">상황이 가까운 순 · 최대 5건</div>'+
  '<div class="cases-table"><div class="cases-head"><span>공시일</span><span>기업</span><span>공시 종류</span><span class="ta-r">직전 20거래일</span><span class="ta-r">이후 20거래일 시장 대비</span></div>'+rows+'</div>'+
  '<div class="cases-cards">'+cards+'</div></div>';
 if(p.same_corp_ratio>0.6)h+='<div class="caution"><b>한 기업에 몰려 있어요</b><span>전체 '+total+'건 중 '+esc(view.same_corp_display||'')+'가 '+esc(p.same_corp_name||'한 기업')+' 사례예요. 업종 전체의 일반적인 결과로 보기 어려워요.</span></div>';
 if(mix.length>1)h+='<p class="scope-note">공시 종류가 섞여 있어요: '+mix.map(([k,v])=>esc(k)+' '+v+'건').join(' · ')+'</p>';
 h+='<details class="explain"><summary>‘시장 대비 성과’는 무슨 뜻인가요?</summary><p>주가 등락에서 시장 흐름의 영향을 걷어낸 값이에요. 코스피와 이 종목의 과거 관계로 만든 기준과 실제 움직임의 차이를 20거래일 동안 더했어요(CAR). 예를 들어 −6.4%p는 6.4% 하락이 아니라, 시장 기준보다 누적 성과가 6.4%포인트 낮았다는 뜻이에요.</p></details>';
 h+='<details class="explain"><summary>어떤 과거 사례를 골랐나요?</summary><p>같은 '+esc(c.sector)+' 업종 · 같은 '+esc(c.event_type)+' 공시의 과거 '+esc(view.peer_window||'기록')+'이에요. 기준 공시 당시 20거래일 결과까지 확인할 수 있었는지 점검했고, 표에는 상황이 가까운 순으로 최대 5건만 보여드려요. 이번 공시 이후의 성과는 사례 선정에 쓰지 않아요.</p></details>';
 return layer('3층','비슷한 상황이<br>과거에도 있었어요',h);
}

function renderDetail(c){
 const fact=c.layer1_fact;
 const links=fact.evidence_links.map((l,i)=>sourceLink(l,fact.evidence_links.length===1?'DART 원문 보기':'공시 '+(i+1)+' 원문 보기','dart-btn')).join('');
 const l1='<p class="fact-lead">'+esc(fact.text)+'</p>'+
  (fact.intro?'<p class="fact-body">'+esc(fact.intro)+'</p>':'')+
  '<div class="fact-actions">'+links+(fact.evidence_links.length===1?'<span class="fact-help">금융감독원 전자공시시스템으로 이동해요</span>':'<span class="fact-help">같은 날 공시 '+fact.evidence_links.length+'건을 묶었어요</span>')+'</div>';
 const html=
  '<div class="band card-top">'+
   '<div class="crumb"><span class="crumb-strong">'+esc(c.corp_name)+'</span><i></i><span>'+esc(c.sector)+'</span><i></i><span class="num">'+esc(ymd(c.event_date))+'</span></div>'+
   '<h1 class="card-h1">'+esc(c.event_type)+'</h1>'+
  '</div>'+
  layer('1층','무슨 일이<br>있었나요?',l1)+
  priceChart(c)+
  reasonInner(c)+
  precedentInner(c)+
  (c.context_notes&&c.context_notes.length?layer('','참고할 점','<ul class="notes">'+c.context_notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>'):'')+
  '<div class="band disclaimer"><p>'+esc(c.disclaimer)+'</p></div>';
 const d=$('#detail');d.innerHTML=html;d.setAttribute('aria-busy','false');
}

async function load(){
 $('#detail').setAttribute('aria-busy','true');
 try{
  const res=await fetch('./data/cards.json');if(!res.ok)throw new Error('data');
  const d=await res.json();if(!Array.isArray(d.cards))throw new Error('schema');
  try{const pr=await fetch('./data/prices.min.json');if(pr.ok){const pd=await pr.json();state.prices=pd.series||{};}}catch{}
  state.cards=d.cards.filter(c=>c.compliance_checked===true&&c.event_date>='2024-01-01');
  if(!state.cards.length){$('#detail').innerHTML='<div class="empty"><h2>표시할 공시 자료가 없어요</h2><p>확인이 끝난 카드가 준비되면 여기에 표시돼요.</p></div>';$('#signals').innerHTML='';$('#result-count').textContent='0건';$('#detail').setAttribute('aria-busy','false');return;}
  $('#company').innerHTML='<option value="">전체 기업</option>'+[...new Set(state.cards.map(c=>c.corp_name))].sort().map(n=>'<option>'+esc(n)+'</option>').join('');
  state.selected=state.cards[0].event_key;renderList();renderDetail(state.cards[0]);
 }catch{
  $('#result-count').textContent='불러오기 실패';$('#signals').innerHTML='';
  $('#detail').innerHTML='<div class="empty" role="alert"><h2>자료를 불러오지 못했어요</h2><p>연결을 확인한 뒤 다시 시도해 주세요.</p><button type="button" data-action="retry">다시 불러오기</button></div>';
  $('#detail').setAttribute('aria-busy','false');
 }
}

$('.filters').addEventListener('click',e=>{const b=e.target.closest('[data-sector]');if(!b)return;state.sector=b.dataset.sector;state.company='';$('#company').value='';document.querySelectorAll('[data-sector]').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b));});filterChanged();});
$('#company').addEventListener('change',e=>{state.company=e.target.value;filterChanged();});
$('#year').addEventListener('change',e=>{state.year=e.target.value;filterChanged();});
$('#more').addEventListener('click',()=>{state.limit+=12;renderList();});
$('#signals').addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(!b)return;const c=state.cards.find(c=>c.event_key===b.dataset.key);if(!c)return;state.selected=c.event_key;renderList();renderDetail(c);if(matchMedia('(max-width:820px)').matches){$('#detail').focus({preventScroll:true});$('#detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}});
$('#detail').addEventListener('click',e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(a==='retry')load();if(a==='reset'){state.sector='';state.company='';state.year='';$('#company').value='';$('#year').value='';const all=document.querySelector('[data-sector=""]');if(all)all.click();}});
load();
