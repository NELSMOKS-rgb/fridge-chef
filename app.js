/* Fridge Chef — offline-first meal finder */
(function(){
'use strict';
const VERSION='1.0.0';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

/* ---------- state ---------- */
const KEY='fridgechef.v1';
const defaults={fridge:[],cupboard:[],shop:[],list:'fridge',tab:'kitchen',
  settings:{basics:true,online:true},filters:{type:'all',quick:false,veg:false}};
let S=load();
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d)return Object.assign({},defaults,d,{settings:Object.assign({},defaults.settings,d.settings),filters:Object.assign({},defaults.filters,d.filters)});}catch(e){}return JSON.parse(JSON.stringify(defaults));}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ---------- ingredient normalisation ---------- */
const ALIAS={};const TERMS=[];
for(const [canon,arr] of Object.entries(VOCAB)){
  const al=arr.slice(1);ALIAS[canon]=canon;TERMS.push({t:canon,c:canon});
  al.forEach(a=>{a=a.toLowerCase();if(!ALIAS[a])ALIAS[a]=canon;TERMS.push({t:a,c:canon});});
}
const BY_LEN=TERMS.slice().sort((a,b)=>b.t.length-a.t.length);
const STOP=/\b(fresh|chopped|diced|sliced|minced|grated|large|small|medium|ripe|frozen|dried|ground|tin(ned)?|can(ned)?|of|cups?|tbsp|tsp|g|kg|ml|l|lb|oz|pinch|handful|to taste|optional|finely|roughly|boneless|skinless|organic)\b/g;
function clean(s){return String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9\- ]+/g,' ').replace(/\s+/g,' ').trim();}
function sing(w){return w.replace(/(ies)$/,'y').replace(/(oes)$/,'o').replace(/([^s])s$/,'$1');}
const memo={};
function normalize(raw){
  const s0=clean(raw);if(!s0)return null;if(s0 in memo)return memo[s0];
  let r=ALIAS[s0]||ALIAS[sing(s0)]||ALIAS[s0.split(' ').map(sing).join(' ')];
  if(!r){const s1=s0.replace(STOP,' ').replace(/\b\d+\b/g,' ').replace(/\s+/g,' ').trim();
    r=ALIAS[s1]||ALIAS[sing(s1)];
    if(!r){const pad=' '+s1+' ', padS=' '+s1.split(' ').map(sing).join(' ')+' ';
      for(const {t,c} of BY_LEN){if(t.length<3)continue;if(pad.includes(' '+t+' ')||padS.includes(' '+t+' ')){r=c;break;}}}}
  memo[s0]=r||null;return memo[s0];
}
const MEAT=new Set(['bacon','ham','chicken','mince','steak','pork','sausages','lamb','fish','salmon','prawns','chorizo','corned beef','tuna','fish sauce','oyster sauce']);
const MEAT_WORDS=/\b(chicken|beef|pork|lamb|bacon|ham|fish|anchov|prawn|shrimp|sausage|chorizo|salami|pancetta|mutton|goat|duck|turkey|veal|gelatin|crab|lobster|mussel|clam|squid|octopus|tuna|salmon|cod|haddock|mackerel|sardine|venison|oxtail|lard|suet|prosciutto|kidney|liver|mince|steak)s?\b/;
const ANIMAL=new Set(['eggs','milk','butter','cheese','parmesan','feta','mozzarella','cream','sour cream','yoghurt','cream cheese','honey','condensed milk']);

/* ---------- kitchen ---------- */
function haveSet(){const h=new Set([...S.fridge,...S.cupboard]);if(S.settings.basics)BASICS.forEach(b=>h.add(b));return h;}
function where(c){return VOCAB[c]?VOCAB[c][0]:null}
function inList(c){return S.fridge.includes(c)?'fridge':S.cupboard.includes(c)?'cupboard':null}
function addItem(text,list){
  list=list||S.list;const c=normalize(text)||clean(text);if(!c)return;
  const ex=inList(c);if(ex){toast(`${cap(c)} is already in your ${ex}`);return;}
  S[list].push(c);S[list].sort();save();renderKitchen();toast(`Added ${c} to ${list}`);
}
function removeItem(c){S.fridge=S.fridge.filter(x=>x!==c);S.cupboard=S.cupboard.filter(x=>x!==c);save();renderKitchen();}

function renderKitchen(){
  const L=S.list;
  $$('.seg-btn').forEach(b=>b.classList.toggle('active',b.dataset.list===L));
  $('#cnt-fridge').textContent=S.fridge.length;$('#cnt-cupboard').textContent=S.cupboard.length;
  $('#addInput').placeholder=L==='fridge'?'Add to fridge… e.g. mince, capsicum':'Add to cupboard… e.g. rice, soy sauce';
  $('#myListTitle').textContent=L==='fridge'?'In your fridge':'In your cupboard';
  const items=S[L];
  $('#myItems').innerHTML=items.map(c=>`<button class="chip" data-rm="${esc(c)}">${esc(c)}<span class="x">✕</span></button>`).join('');
  $('#emptyHint').hidden=items.length>0;$('#clearList').hidden=!items.length;
  const st=STAPLES[L==='fridge'?'f':'c'];
  $('#staples').innerHTML=st.map(c=>{const w=inList(c);return `<button class="chip ${w===L?'on':w?'on other':''}" data-st="${esc(c)}">${esc(c)}</button>`}).join('');
  // shopping list
  $('#shopItems').innerHTML=S.shop.map(c=>`<label><input type="checkbox" data-shop="${esc(c)}"> ${esc(c)}</label>`).join('');
  $('#shopHint').hidden=S.shop.length>0;$('#clearShop').hidden=!S.shop.length;
  const n=S.fridge.length+S.cupboard.length;
  $('#subline').textContent=n?`${n} ingredient${n>1?'s':''} in your kitchen`:"What's in your kitchen?";
  updateBadge();
}

/* autocomplete */
let sugIdx=-1,sugList=[];
function suggest(q){
  q=clean(q);const box=$('#suggest');
  if(!q){box.hidden=true;sugList=[];return;}
  const seen=new Set(),res=[];
  const push=(t,c)=>{if(seen.has(c))return;seen.add(c);res.push({t,c});};
  for(const {t,c} of TERMS){if(t===c&&c.startsWith(q))push(t,c);}
  for(const {t,c} of TERMS){if(t.startsWith(q))push(t,c);}
  for(const {t,c} of TERMS){if(res.length>=8)break;if(t.includes(' '+q)||(q.length>2&&t.includes(q)))push(t,c);}
  sugList=res.slice(0,8);sugIdx=sugList.length?0:-1;
  if(!sugList.length){box.innerHTML=`<li data-raw="1"><span>Add “${esc(q)}”</span><span class="where">custom</span></li>`;box.hidden=false;return;}
  box.innerHTML=sugList.map((s,i)=>{const have=inList(s.c);const label=s.t===s.c?esc(s.c):`${esc(s.t)} <span class="where">→ ${esc(s.c)}</span>`;
    return `<li class="${i===0?'hl':''}" data-c="${esc(s.c)}"><span>${label}</span><span class="where">${have?'✓ in '+have:''}</span></li>`}).join('');
  box.hidden=false;
}
function commitAdd(){
  const inp=$('#addInput');const v=inp.value.trim();if(!v)return;
  const pick=sugIdx>=0&&sugList[sugIdx]?sugList[sugIdx].c:v;
  addItem(pick);inp.value='';suggest('');inp.focus();
}

/* ---------- recipes ---------- */
let ONLINE=[]; // normalized TheMealDB recipes
function scoreAll(){
  const have=haveSet();const out=[];
  const all=RECIPES.map(r=>({...r,src:'built'})).concat(ONLINE);
  for(const r of all){
    const req=r.i.filter(x=>!x.o&&!(S.settings.basics&&BASICS.includes(x.k)));
    if(!req.length)continue;
    const miss=req.filter(x=>!have.has(x.k));
    const optHave=r.i.filter(x=>x.o&&have.has(x.k)).length;
    const pct=Math.round((req.length-miss.length)/req.length*100);
    out.push({r,pct,miss:miss.map(x=>x.k),optHave,req:req.length});
  }
  out.sort((a,b)=>b.pct-a.pct||a.miss.length-b.miss.length||b.optHave-a.optHave||(a.r.src==='built'?-1:1)||(a.r.m||99)-(b.r.m||99));
  return out;
}
function passFilters(x){
  const r=x.r,f=S.filters;
  if(f.type!=='all'&&!r.t.includes(f.type))return false;
  if(f.quick&&!(r.m&&r.m<30))return false;
  if(f.veg&&!r.v)return false;
  const q=clean($('#recipeSearch').value);
  if(q&&!clean(r.n).includes(q)&&!r.i.some(i=>i.k.includes(q)))return false;
  return true;
}
function updateBadge(){
  const n=scoreAll().filter(x=>!x.miss.length&&passFilters(x)).length;
  const b=$('#readyBadge');b.textContent=n;b.hidden=!n;
}
const TYPES=[['all','All'],['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner'],['snack','Snacks & sides'],['dessert','Dessert & baking']];
let showMore=false;
function fmtTime(m){if(m<60)return m+' min';const h=Math.floor(m/60),r=m%60;return h+' h'+(r?' '+r+' min':'');}
function card(x){
  const r=x.r;const col=x.pct===100?'var(--good)':x.pct>=60?'var(--accent)':'var(--warn)';
  const tags=[];if(r.m)tags.push(`⏱ ${fmtTime(r.m)}`);
  if(r.v)tags.push(`<span class="tag veg">${r.v===2?'vegan':'veg'}</span>`);
  if(r.src==='web')tags.push('<span class="tag web">online</span>');
  tags.push(`<span class="tag">${r.t.map(cap).join(' · ')}</span>`);
  const miss=x.miss.length?`<div class="missing">Missing: ${x.miss.map(esc).join(', ')}</div>`:'';
  const lead=r.img?`<img class="thumb" loading="lazy" src="${esc(r.img)}/small" alt="" onerror="this.remove()">`:'';
  return `<button class="card" data-id="${esc(r.id)}">${lead}<div class="info"><div class="name">${esc(r.n)}</div><div class="meta">${tags.join('')}</div>${miss}</div><div class="ring" style="--p:${x.pct};--c:${col}"><span>${x.pct}%</span></div></button>`;
}
function renderCook(){
  $('#typeFilters').innerHTML=TYPES.map(([k,l])=>`<button class="chip ${S.filters.type===k?'on':''}" data-type="${k}">${l}</button>`).join('');
  $('#fQuick').classList.toggle('on',S.filters.quick);$('#fVeg').classList.toggle('on',S.filters.veg);
  const n=S.fridge.length+S.cupboard.length;
  if(!n){$('#results').innerHTML=`<div class="empty"><div class="big">🧺</div><p>Add a few things from your fridge and cupboard first.</p><button class="btn primary" data-goto="kitchen">Go to my kitchen</button></div>`;return;}
  const sc=scoreAll().filter(passFilters);
  const ready=sc.filter(x=>!x.miss.length),almost=sc.filter(x=>x.miss.length>0&&x.miss.length<=2&&x.pct>=50),
        more=sc.filter(x=>x.miss.length>2&&x.pct>=34||(x.miss.length<=2&&x.pct<50&&x.miss.length>0));
  let h='';
  h+=`<div class="sec-title"><h2>✅ Cook now</h2><span class="n">${ready.length}</span></div>`;
  h+=ready.length?ready.map(card).join(''):`<p class="hint">Nothing you can make with everything on hand yet. Check “Almost there” below, or add a few more staples.</p>`;
  h+=`<div class="sec-title"><h2>🛒 Almost there · missing 1–2</h2><span class="n">${almost.length}</span></div>`;
  h+=almost.length?almost.slice(0,60).map(card).join(''):`<p class="hint">No near matches with these filters.</p>`;
  if(more.length){h+=`<div class="sec-title"><h2>💡 More ideas</h2><span class="n">${more.length}</span></div>`;
    h+=showMore?more.slice(0,80).map(card).join(''):`<button class="btn more-btn" id="moreBtn">Show ${Math.min(more.length,80)} more ideas</button>`;}
  $('#results').innerHTML=h;
  updateBadge();
  maybeLoadOnline();
}

/* ---------- recipe sheet ---------- */
function findRecipe(id){return RECIPES.find(r=>r.id===id)||ONLINE.find(r=>r.id===id);}
function openRecipe(id,push=true){
  const r=findRecipe(id);if(!r)return;const have=haveSet();
  const req=r.i.filter(x=>!x.o&&!(S.settings.basics&&BASICS.includes(x.k)));
  const miss=req.filter(x=>!have.has(x.k));const pct=req.length?Math.round((req.length-miss.length)/req.length*100):100;
  const ing=r.i.map(x=>{const h=have.has(x.k)||(S.settings.basics&&BASICS.includes(x.k));
    const opt=x.o?` <span class="opt">optional${MEAT.has(x.k)&&r.v?' · skip if vegetarian':''}</span>`:'';
    const nm=x.label||x.k;
    return `<li class="${h?'have':x.o?'':'need'}"><span class="mk">${h?'✓':x.o?'·':'✗'}</span><span class="nm">${esc(cap(nm))}${opt}</span><span class="q">${esc(x.q||'')}</span></li>`}).join('');
  const meta=[`<span class="pill ${pct===100?'good':'warn'}">${pct}% match</span>`];
  if(r.m)meta.push(`<span class="pill">⏱ ${fmtTime(r.m)}</span>`);
  if(r.v)meta.push(`<span class="pill good">🌱 ${r.v===2?'Vegan':'Vegetarian'}</span>`);
  meta.push(`<span class="pill">${r.t.map(cap).join(' · ')}</span>`);
  if(r.area)meta.push(`<span class="pill">${esc(r.area)}</span>`);
  $('#sheetSource').textContent=r.src==='web'?'From TheMealDB (online)':'Built-in recipe · works offline';
  $('#sheetBody').innerHTML=`${r.img?`<img class="hero" src="${esc(r.img)}" alt="" onerror="this.remove()">`:''}
   <h2 class="r-title" style="text-transform:none;color:var(--text);letter-spacing:0">${esc(r.n)}</h2>
   <div class="r-meta">${meta.join('')}</div>
   ${miss.length?`<button class="btn primary" id="addMissing" style="width:100%">🛒 Add ${miss.length} missing to shopping list</button>`:`<div class="pill good" style="display:block;text-align:center;padding:10px">You've got everything for this one 🎉</div>`}
   <h2 class="r-h">Ingredients</h2><ul class="ing">${ing}</ul>
   <h2 class="r-h">Method</h2><ol class="steps">${r.s.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
   ${r.src==='web'&&r.url?`<p class="small muted" style="margin-top:14px">Source: <a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--accent2)">original recipe</a></p>`:''}`;
  const am=$('#addMissing');if(am)am.onclick=()=>{let n=0;miss.forEach(x=>{if(!S.shop.includes(x.k)){S.shop.push(x.k);n++;}});save();renderKitchen();toast(n?`Added ${n} to shopping list`:'Already on your list');};
  $('#sheet').hidden=false;$('#sheet .sheet-inner').scrollTop=0;document.body.style.overflow='hidden';
  if(push)history.pushState({sheet:id},'','#r='+encodeURIComponent(id));
}
function closeSheets(fromPop){
  const was=!$('#sheet').hidden||!$('#settings').hidden;
  $('#sheet').hidden=true;$('#settings').hidden=true;document.body.style.overflow='';
  if(was&&!fromPop&&history.state&&(history.state.sheet||history.state.settings))history.back();
}
window.addEventListener('popstate',()=>closeSheets(true));

/* ---------- TheMealDB (optional, free, no key) ---------- */
const API='https://www.themealdb.com/api/json/v1/1/';
const MDB_KEY='fridgechef.mealdb.v1';
const ANCHORS=[['chicken',['chicken','chicken_thighs']],['mince',['minced_beef']],['steak',['beef']],['pork',['pork']],['lamb',['lamb']],['salmon',['salmon']],['prawns',['prawns']],['fish',['white_fish']],['sausages',['sausages']],['chorizo',['chorizo']],['bacon',['bacon']],['ham',['ham']],['tuna',['tuna']],['tofu',['tofu']],['chickpeas',['chickpeas']],['eggplant',['aubergine']],['courgette',['courgettes']],['mushrooms',['mushrooms']],['pumpkin',['pumpkin']],['spinach',['spinach']],['broccoli',['broccoli']],['leek',['leek']],['cabbage',['cabbage']],['avocado',['avocado']],['coconut milk',['coconut_milk']],['kumara',['sweet_potatoes']],['cheese',['cheddar_cheese']],['rice',['rice']],['pasta',['spaghetti']],['tomato',['tomatoes']],['capsicum',['red_pepper']],['potato',['potatoes']],['eggs',['eggs']]];
let mdbCache=(()=>{try{return JSON.parse(localStorage.getItem(MDB_KEY)||'{}')}catch(e){return{}}})();
mdbCache.meals=mdbCache.meals||{};mdbCache.filters=mdbCache.filters||{};
function saveMdb(){try{const ids=Object.keys(mdbCache.meals);if(ids.length>260){ids.slice(0,ids.length-260).forEach(i=>delete mdbCache.meals[i]);}localStorage.setItem(MDB_KEY,JSON.stringify(mdbCache));}catch(e){}}
function compactMeal(m){
  const ing=[];for(let i=1;i<=20;i++){const n=(m['strIngredient'+i]||'').trim();if(!n)continue;ing.push([n,(m['strMeasure'+i]||'').trim()]);}
  const steps=(m.strInstructions||'').split(/\r?\n+/).map(s=>s.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i,'').trim()).filter(s=>s.length>2);
  return {id:m.idMeal,n:m.strMeal,c:m.strCategory||'',a:m.strArea||'',img:m.strMealThumb||'',u:m.strSource||m.strYoutube||'',ing,steps};
}
function toRecipe(c){
  const cat=(c.c||'').toLowerCase();
  const t=cat==='breakfast'?['breakfast']:cat==='dessert'?['dessert']:cat==='starter'?['snack','lunch']:cat==='side'?['snack']:['dinner','lunch'];
  const seen=new Set();const i=[];
  c.ing.forEach(([n,q])=>{const k=normalize(n)||clean(n);if(!k||seen.has(k))return;seen.add(k);i.push({k,q,o:0,label:n.toLowerCase()});});
  const meaty=i.some(x=>MEAT.has(x.k)||MEAT_WORDS.test(x.k))||['beef','chicken','lamb','pork','seafood','goat'].includes(cat);
  const v=meaty?0:(cat==='vegan'?2:1);
  let steps=c.steps;if(steps.length===1)steps=steps[0].split(/(?<=\.)\s+(?=[A-Z])/);
  return {id:'m'+c.id,n:c.n,t,m:null,v,i,s:steps,img:c.img,area:c.a,url:c.u,src:'web'};
}
function dedupeKey(n){return clean(n).replace(/\b(the|easy|classic|homemade|simple|best|kiwi|nz)\b/g,'').replace(/[^a-z]/g,'');}
const builtKeys=new Set(RECIPES.map(r=>dedupeKey(r.n)));
function rebuildOnline(){
  const seen=new Set();ONLINE=[];
  for(const c of Object.values(mdbCache.meals)){const k=dedupeKey(c.n);if(builtKeys.has(k)||seen.has(k))continue;seen.add(k);ONLINE.push(toRecipe(c));}
}
rebuildOnline();
let loading=false,lastSig='',failAt=0;
async function getJSON(u){const r=await fetch(u);if(!r.ok)throw new Error(r.status);return r.json();}
async function maybeLoadOnline(){
  const st=$('#onlineStatus');
  if(!S.settings.online){st.hidden=true;return;}
  if(!navigator.onLine){st.hidden=false;st.textContent=`📴 Offline: showing ${RECIPES.length} built-in recipes${ONLINE.length?` + ${ONLINE.length} saved online ones`:''}.`;return;}
  const have=haveSet();const anchors=ANCHORS.filter(([k])=>have.has(k)).slice(0,4);
  const sig=anchors.map(a=>a[0]).join(',');
  if(!anchors.length||loading||sig===lastSig||Date.now()-failAt<60000){if(ONLINE.length&&!loading){st.hidden=false;st.textContent=`🌐 ${RECIPES.length} built-in + ${ONLINE.length} online recipes from TheMealDB`;}return;}
  loading=true;lastSig=sig;st.hidden=false;st.textContent='🌐 Finding extra recipes online…';
  try{
    const counts={};
    for(const [,names] of anchors){for(const nm of names){
      let ids=mdbCache.filters[nm];
      if(!ids||Date.now()-(ids.at||0)>7*864e5){const d=await getJSON(API+'filter.php?i='+nm);ids={at:Date.now(),l:(d.meals||[]).map(m=>m.idMeal)};mdbCache.filters[nm]=ids;}
      ids.l.forEach(id=>counts[id]=(counts[id]||0)+1);
    }}
    const want=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).filter(id=>!mdbCache.meals[id]).slice(0,24);
    for(let i=0;i<want.length;i+=6){
      const batch=await Promise.all(want.slice(i,i+6).map(id=>getJSON(API+'lookup.php?i='+id).catch(()=>null)));
      batch.forEach(d=>{const m=d&&d.meals&&d.meals[0];if(m)mdbCache.meals[m.idMeal]=compactMeal(m);});
    }
    saveMdb();rebuildOnline();
    st.textContent=`🌐 ${RECIPES.length} built-in + ${ONLINE.length} online recipes from TheMealDB`;
  }catch(e){st.textContent=`Couldn't reach TheMealDB, so showing built-in recipes only.`;lastSig='';failAt=Date.now();saveMdb();rebuildOnline();}
  loading=false;
  if(S.tab==='cook'){const y=window.scrollY;renderCook();window.scrollTo(0,y);}
}
/* ---------- UI wiring ---------- */
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,1800);}
function setTab(t){S.tab=t;save();$$('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+t));$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  if(t==='cook')renderCook();else renderKitchen();window.scrollTo(0,0);}

document.addEventListener('click',e=>{
  const b=e.target.closest('button,li,[data-goto]');if(!b)return;
  if(b.dataset.list){S.list=b.dataset.list;save();renderKitchen();return;}
  if(b.dataset.tab){setTab(b.dataset.tab);return;}
  if(b.dataset.goto){setTab(b.dataset.goto);return;}
  if(b.dataset.rm){removeItem(b.dataset.rm);return;}
  if(b.dataset.st){const c=b.dataset.st;inList(c)?removeItem(c):addItem(c);return;}
  if(b.dataset.c){addItem(b.dataset.c);$('#addInput').value='';suggest('');$('#addInput').focus();return;}
  if(b.dataset.raw){commitAdd();return;}
  if(b.dataset.type){S.filters.type=b.dataset.type;save();renderCook();return;}
  if(b.dataset.id){openRecipe(b.dataset.id);return;}
  if(b.id==='moreBtn'){showMore=true;renderCook();return;}
});
document.addEventListener('change',e=>{const c=e.target.dataset&&e.target.dataset.shop;if(!c)return;
  S.shop=S.shop.filter(x=>x!==c);const w=where(c)==='c'?'cupboard':'fridge';if(!inList(c)){S[w].push(c);S[w].sort();}save();
  setTimeout(()=>{renderKitchen();toast(`Bought ${c}, added to ${w}`)},250);});
const inp=$('#addInput');
inp.addEventListener('input',()=>suggest(inp.value));
inp.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();commitAdd();}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){if(!sugList.length)return;e.preventDefault();sugIdx=(sugIdx+(e.key==='ArrowDown'?1:-1)+sugList.length)%sugList.length;$$('#suggest li').forEach((l,i)=>l.classList.toggle('hl',i===sugIdx));}
  else if(e.key==='Escape'){suggest('');}
});
inp.addEventListener('blur',()=>setTimeout(()=>{$('#suggest').hidden=true},180));
inp.addEventListener('focus',()=>{if(inp.value)suggest(inp.value)});
$('#addBtn').onclick=commitAdd;
$('#clearList').onclick=()=>{if(confirm(`Clear everything in your ${S.list}?`)){S[S.list]=[];save();renderKitchen();}};
$('#clearShop').onclick=()=>{S.shop=[];save();renderKitchen();};
$('#goCook').onclick=()=>setTab('cook');
$('#fQuick').onclick=()=>{S.filters.quick=!S.filters.quick;save();renderCook();};
$('#fVeg').onclick=()=>{S.filters.veg=!S.filters.veg;save();renderCook();};
let st;$('#recipeSearch').addEventListener('input',()=>{clearTimeout(st);st=setTimeout(renderCook,150)});
$('#sheetClose').onclick=()=>closeSheets();$('#settingsClose').onclick=()=>closeSheets();
$('#settingsBtn').onclick=()=>{$('#sBasics').checked=S.settings.basics;$('#sOnline').checked=S.settings.online;
  $('#aboutLine').textContent=`Fridge Chef v${VERSION} · ${RECIPES.length} built-in recipes · ${ONLINE.length} saved online recipes · your lists stay on this phone.`;
  $('#settings').hidden=false;document.body.style.overflow='hidden';history.pushState({settings:1},'','#settings');};
$('#sBasics').onchange=e=>{S.settings.basics=e.target.checked;save();renderKitchen();};
$('#sOnline').onchange=e=>{S.settings.online=e.target.checked;save();};
$('#exportBtn').onclick=async()=>{const t=JSON.stringify({fridge:S.fridge,cupboard:S.cupboard,shop:S.shop});try{await navigator.clipboard.writeText(t);toast('Copied! Paste it somewhere safe.');}catch(e){prompt('Copy this:',t);}};
$('#importBtn').onclick=()=>{const t=prompt('Paste your saved lists:');if(!t)return;try{const d=JSON.parse(t);['fridge','cupboard','shop'].forEach(k=>{if(Array.isArray(d[k]))S[k]=d[k].map(String)});save();renderKitchen();toast('Lists restored');}catch(e){toast("That didn't look right");}};
window.addEventListener('online',()=>{if(S.tab==='cook')renderCook();});
window.addEventListener('offline',()=>{if(S.tab==='cook')renderCook();});


/* ---------- boot ---------- */
renderKitchen();setTab(S.tab||'kitchen');
if(location.hash.startsWith('#r=')){const id=decodeURIComponent(location.hash.slice(3));history.replaceState(null,'',location.pathname);setTimeout(()=>openRecipe(id),50);}
else if(location.hash)history.replaceState(null,'',location.pathname);
if('serviceWorker' in navigator&&location.protocol!=='file:'){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
window.__fc={normalize,scoreAll,S:()=>S,online:()=>ONLINE.length};
})();
