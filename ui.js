
/* ══════════════════════════════════════════════════════
   CAJA CASA · Presentación y acciones de la caja
══════════════════════════════════════════════════════ */

/* ─── CATEGORÍAS + ICONOS (line-art v1, conservados) ─── */
var CATS_E = [
  {id:'mercado',    name:'Mercado'},
  {id:'comida',     name:'Comida'},
  {id:'transporte', name:'Transporte'},
  {id:'hogar',      name:'Hogar'},
  {id:'salud',      name:'Salud'},
  {id:'ocio',       name:'Ocio'},
  {id:'ropa',       name:'Ropa'},
  {id:'servicios',  name:'Servicios'},
  {id:'otros',      name:'Otros'},
];
var CATS_I = [{id:'ingreso', name:'Ingreso'}];

/* ══════════════════════════════════════════════════════
   SVG ICONS PER CATEGORY
══════════════════════════════════════════════════════ */
var CAT_ICONS = {
  // === CLARIDAD ORIGINALS (exact SVGs from Claude Design) ===
  ocio: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M3.5 4H16.5L10 11L3.5 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 11V16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7 17H13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="13" cy="5.5" r="1.2" fill="currentColor"/></svg>'
  },
  mercado: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M4 6H16L15 16H5L4 6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 6V4.5C7 3 8.3 2 10 2C11.7 2 13 3 13 4.5V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  },
  comida: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M6 3V8.5C6 9.3 6.7 10 7.5 10V17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 3V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 3V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13.5 3C12.5 3 12 4 12 5.5V10H13.5V17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  },
  transporte: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><rect x="4" y="5" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="15" r="1.5" stroke="currentColor" stroke-width="1.6"/><circle cx="13" cy="15" r="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M4 10H16" stroke="currentColor" stroke-width="1.6"/></svg>'
  },
  hogar: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M3 10L10 3L17 10V16H12V12H8V16H3V10Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  },
  ingreso: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><g transform="rotate(180 10 10)"><path d="M10 4V16M10 4L5 9M10 4L15 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>'
  },
  // === EXTENDED (same Claridad line-art style) ===
  salud: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 17C5.5 13 2.5 10.5 2.5 7.5C2.5 5.5 4 4 6 4C7.5 4 9 4.8 10 6C11 4.8 12.5 4 14 4C16 4 17.5 5.5 17.5 7.5C17.5 10.5 14.5 13 10 17Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  },
  ropa: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M7 3L4 5.5L6 7.5V17H14V7.5L16 5.5L13 3L11.5 4.5C11 5 10.5 5.2 10 5.2C9.5 5.2 9 5 8.5 4.5L7 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  },
  servicios: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><path d="M11 3L5 11H9L9 17L15 9H11L11 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  },
  otros: {
    bg: 'var(--tint)',
    fg: 'var(--accent-strong)',
    svg: '<svg viewBox="0 0 20 20" fill="none"><circle cx="5" cy="10" r="1.4" fill="currentColor"/><circle cx="10" cy="10" r="1.4" fill="currentColor"/><circle cx="15" cy="10" r="1.4" fill="currentColor"/><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.3" opacity="0.5"/></svg>'
  }
};

function getCatIcon(catId) {
  return CAT_ICONS[catId] || CAT_ICONS['otros'];
}

/* ─── HELPERS ──────────────────────────────────────────── */
var MN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var DS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
var MS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmt(n){ return new Intl.NumberFormat('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0}).format(n); }
function fmtAmt(n){ return '$'+fmt(n); }
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function localISO(){
  var d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().replace('Z','');
}
function dateLabel(dstr){
  var d = new Date(dstr), now = new Date();
  var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var diff = Math.round((n0 - d0) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return DS[d.getDay()] + ' ' + d.getDate() + ' ' + MS[d.getMonth()];
}
/* Contador animado: interpola desde el valor ACTUAL (no desde 0) */
var _numState = {};
function animateNum(el, to){ el.textContent = fmt(to); }

/* ─── CÁLCULOS ─────────────────────────────────────────── */
function balance(){
  var cfg = effectiveConfig();
  return effectiveTxs().reduce(function(acc,t){
    return acc + (t.type==='ingreso' ? t.amount : -t.amount);
  }, cfg.initialBalance);
}
function monthStats(){
  var now = new Date(), inc = 0, out = 0;
  effectiveTxs().forEach(function(t){
    var d = new Date(t.date);
    if (d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()) {
      if (t.type==='ingreso') inc += t.amount; else out += t.amount;
    }
  });
  return { inc: inc, out: out };
}
function countMonth(type, m, y){
  var n = 0;
  effectiveTxs().forEach(function(t){
    var d = new Date(t.date);
    if (t.type===type && d.getMonth()===m && d.getFullYear()===y) n++;
  });
  return n;
}
var personFilter = 'all';
var searchTerm = '';
function normalizeSearch(value){ return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function filteredTxs(){
  var txs = effectiveTxs().slice(), now = new Date();
  if (currentFilter==='mes') txs = txs.filter(function(t){ var d=new Date(t.date); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  else if (currentFilter==='semana') {
    var first = new Date(now.getFullYear(),now.getMonth(),now.getDate()-6).getTime();
    var end = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime();
    txs = txs.filter(function(t){ var time=new Date(t.date).getTime(); return time>=first && time<end; });
  }
  if (personFilter!=='all') txs=txs.filter(function(t){ return t.person===personFilter; });
  var query=normalizeSearch(searchTerm.trim());
  if (query) txs=txs.filter(function(t){ return normalizeSearch([t.description,categoryFor(t).name,t.amount,t.person==='d'?S.names.d:S.names.t].join(' ')).includes(query); });
  return txs.sort(function(a,b){ return new Date(b.date)-new Date(a.date) || String(b.id).localeCompare(String(a.id)); });
}
function setPersonFilter(value){ personFilter=value; renderList(); }
function searchTransactions(value){ searchTerm=value; renderList(); }
function categoryFor(tx){
  var cats=tx.type==='ingreso'?CATS_I:CATS_E;
  return cats.find(function(c){return c.id===tx.category;}) || cats[cats.length-1];
}
function render(){
  var cfg=effectiveConfig(), now=new Date(), ms=monthStats();
  document.getElementById('app').classList.toggle('private',S.hideBalance);
  S.names.d=cfg.name1; S.names.t=cfg.name2;
  document.getElementById('headerSub').textContent=cfg.name1+' & '+cfg.name2;
  var waiting=S.server.v===null && !S.server.transactions.length;
  document.getElementById('balanceNum').textContent=S.hideBalance?'••••••':waiting?'—':fmt(Math.abs(balance()));
  document.getElementById('balanceCurrency').textContent=!S.hideBalance && !waiting && balance()<0?'−$':'$';
  document.getElementById('balanceCaption').textContent=waiting?'Esperando el saldo de la caja'+(S.outbox.length?' · hay movimientos guardados aquí':''):S.outbox.length?'Incluye movimientos pendientes de sincronizar':'Saldo inicial + ingresos − gastos';
  document.getElementById('privacyBtn').textContent=S.hideBalance?'Mostrar saldo':'Ocultar saldo';
  document.getElementById('privacyBtn').setAttribute('aria-pressed',String(S.hideBalance));
  document.getElementById('monthPill').textContent=MN[now.getMonth()]+' '+now.getFullYear();
  document.getElementById('statIn').textContent=S.hideBalance?'••••':waiting?'—':fmt(ms.inc);
  document.getElementById('statOut').textContent=S.hideBalance?'••••':waiting?'—':fmt(ms.out);
  document.getElementById('monthStats').classList.toggle('wide-figures',!S.hideBalance && Math.max(fmt(ms.inc).length,fmt(ms.out).length)>10);
  document.getElementById('balanceNum').setAttribute('data-size',S.hideBalance?'regular':fmt(balance()).length>17?'long':fmt(balance()).length>12?'medium':'regular');
  var net=ms.inc-ms.out;
  document.getElementById('trendLine').textContent=S.hideBalance?'Balance del mes oculto':waiting?'Los totales aparecerán al recibir los datos.':'Balance del mes: '+(net<0?'−':'+')+fmtAmt(Math.abs(net));
  var incCount=countMonth('ingreso',now.getMonth(),now.getFullYear()), outCount=countMonth('egreso',now.getMonth(),now.getFullYear());
  document.getElementById('statInTrend').textContent=waiting?'Esperando datos':incCount+' '+(incCount===1?'ingreso':'ingresos')+' este mes';
  document.getElementById('statOutTrend').textContent=waiting?'Esperando datos':outCount+' '+(outCount===1?'gasto':'gastos')+' este mes';
  document.getElementById('personDFilter').textContent=cfg.name1;
  document.getElementById('personTFilter').textContent=cfg.name2;
  var duplicates=Number(S.server.duplicateRows)||0, note=document.getElementById('dataNote');
  note.hidden=!duplicates;
  note.textContent=duplicates+' registros repetidos del historial se cuentan una sola vez. Las filas originales se conservan.';
  renderList();
  renderFailedOperations();
}

function renderList(){
  var list=document.getElementById('txList'), txs=filteredTxs();
  document.getElementById('resultCount').textContent=txs.length+' '+(txs.length===1?'movimiento':'movimientos');
  if (!txs.length) {
    var filtered=searchTerm.trim() || personFilter!=='all' || effectiveTxs().length;
    list.innerHTML='<div class="empty"><div class="empty-symbol" aria-hidden="true">'+(filtered?'⌕':'＋')+'</div><strong>'+(filtered?'Sin resultados':'La caja empieza aquí')+'</strong><p>'+(filtered?'Prueba otra búsqueda, persona o período.':'Registra el efectivo que entra y sale. Daniel y Thalía verán los mismos movimientos cuando se sincronicen.')+'</p></div>';
    return;
  }
  var groups={}, order=[];
  txs.forEach(function(t){var k=new Date(t.date).toDateString(); if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(t);});
  list.innerHTML=order.map(function(k){var g=groups[k];return '<h3 class="date-sep">'+dateLabel(g[0].date)+'</h3><div class="tx-group">'+g.map(txHTML).join('')+'</div>';}).join('');
  initSwipeItems();
}
function txHTML(tx){
  var cat=categoryFor(tx), ic=getCatIcon(cat.id), who=tx.person==='d'?S.names.d:S.names.t;
  var pending=isPending(tx.id);
  var failed=S.outbox.some(function(op){return (op.op==='add' || op.op==='edit') && op.payload.tx.id===tx.id && op.status==='failed';});
  if(!failed)failed=S.outbox.some(function(operation){return operation.op==='addBatch' && operation.rows.some(function(row){return row.transactionId===tx.id && row.status==='failed';});});
  var name=tx.description || cat.name;
  var meta=esc(who)+' · '+esc(cat.name);
  var state=pending?'<span class="tx-status'+(failed?' failed':'')+'">'+(failed?'No sincronizado · revisar':'Pendiente de sincronizar')+'</span>':'';
  var amount=S.hideBalance?'••••':(tx.type==='ingreso'?'+':'−')+fmtAmt(tx.amount);
  return '<article class="tx-wrap'+(!S.hideBalance && amount.length>14?' wide-figure':'')+'" data-id="'+esc(tx.id)+'">'
    +'<button class="tx-del" tabindex="-1" aria-label="Eliminar '+esc(name)+'">Eliminar</button>'
    +'<div class="tx-item'+(pending?' pending':'')+'"><div class="tx-icon" aria-hidden="true" style="background:'+ic.bg+'">'+ic.svg+'</div>'
    +'<div class="tx-body"><div class="tx-name" title="'+esc(name)+'">'+esc(name)+'</div><div class="tx-meta">'+meta+'</div>'+state+'</div>'
    +'<div class="tx-side"><div class="tx-amount '+esc(tx.type)+' num">'+amount+'</div><button class="tx-menu" aria-label="Editar '+esc(name)+'">Editar</button></div></div></article>';
}

/* ─── PRIVACIDAD ──────────────────────────────────────── */
function togglePrivacy(){
  S.hideBalance = !S.hideBalance;
  try { lsSet(LS.privacy, S.hideBalance); } catch(e){}
  render();
}

/* ─── SEGMENTED CONTROL ────────────────────────────────── */
function initSeg(){
  var active = document.querySelector('.seg-btn.active');
  if (active) movePill(active);
}
function movePill(btn){
  var pill = document.getElementById('segPill');
  pill.style.left = btn.offsetLeft + 'px';
  pill.style.width = btn.offsetWidth + 'px';
}
function segClick(btn){
  var btns = document.querySelectorAll('.seg-btn');
  for (var i=0;i<btns.length;i++) btns[i].classList.remove('active');
  btn.classList.add('active');
  movePill(btn);
  currentFilter = btn.getAttribute('data-f');
  renderList();
}

function closeFab(){}
function openSat(type){ F.type=type; openAdd(); }

/* ─── REGISTRO: persistir primero, cerrar después ─────── */
var F={type:'egreso',amount:'',cat:null,person:'d',step:1,submitted:false};
function openAdd(){
  F={type:F.type||'egreso',amount:'',cat:null,person:lsGet('cajaLastPerson','d')==='t'?'t':'d',step:1,submitted:false};
  document.getElementById('descInput').value='';
  document.getElementById('dateInput').value=localISO().slice(0,10);
  document.getElementById('dateInput').max=localISO().slice(0,10);
  document.getElementById('formError').textContent='';
  document.getElementById('saveTxBtn').disabled=false;
  goStep1(); open_('addModal');
}
function editTx(id){
  var tx=effectiveTxs().find(function(item){return item.id===id;});
  if(!tx){toast('Este movimiento ya no está disponible.');return;}
  var before=Object.assign({},tx);
  F={type:tx.type,amount:String(tx.amount),cat:tx.category||'',person:tx.person,
    step:1,submitted:false,editId:tx.id,before:before,originalDay:tx.date.slice(0,10)};
  document.getElementById('descInput').value=tx.description||'';
  document.getElementById('dateInput').value=F.originalDay;
  document.getElementById('dateInput').max=localISO().slice(0,10);
  document.getElementById('formError').textContent='';
  document.getElementById('saveTxBtn').disabled=false;
  resetSwipe();goStep1();open_('addModal');
}
function deleteEditingTx(){if(F.editId)delTx(F.editId);}
function goStep1(){
  F.step=1;
  document.getElementById('step1').hidden=false;
  document.getElementById('step2').hidden=true;
  syncForm();
}
function goStep2(){
  if(!F.amount || !Number.isSafeInteger(Number(F.amount)) || Number(F.amount)<=0 || Number(F.amount)>1000000000000) return;
  if(F.cat===null) F.cat=F.type==='egreso'?'otros':'ingreso';
  F.step=2;
  document.getElementById('step1').hidden=true;
  document.getElementById('step2').hidden=false;
  syncForm();
  document.getElementById('descInput').focus({preventScroll:true});
}
function setType(type){if(F.type!==type){F.type=type;F.cat=null;}goStep1();}
function setPerson(person){F.person=person;syncForm();}
function syncForm(){
  document.getElementById('addModal').setAttribute('data-step',String(F.step));
  document.getElementById('addTitle').textContent=F.editId?'Editar movimiento':F.type==='egreso'?'Nuevo gasto':'Nuevo ingreso';
  document.getElementById('saveTxBtn').textContent=F.editId?'Guardar cambios':'Guardar movimiento';
  document.getElementById('editDeleteBtn').hidden=!F.editId;
  document.getElementById('formStep').textContent=F.step===1?'1 de 2 · Monto y categoría':'2 de 2 · Detalles';
  document.getElementById('amtPre').textContent=(F.type==='egreso'?'−':'+')+'$';
  var amount=document.getElementById('amountInput');
  var visibleAmount=F.amountError?F.amountRaw:F.amount;
  if(amount.value!==visibleAmount) amount.value=visibleAmount;
  amount.style.color=F.type==='egreso'?'var(--neg)':'var(--pos)';
  document.getElementById('amountInput').style.fontSize=visibleAmount.length>10?'28px':visibleAmount.length>8?'34px':'';
  document.getElementById('amountHint').textContent=F.amountError || (Number(F.amount)>1000000000000?'El monto máximo es $1.000.000.000.000.':F.amount?fmtAmt(Number(F.amount))+' COP':'Pesos colombianos · sin decimales');
  document.getElementById('tbE').className='type-btn'+(F.type==='egreso'?' active-e':'');
  document.getElementById('tbI').className='type-btn'+(F.type==='ingreso'?' active-i':'');
  document.getElementById('tbE').setAttribute('aria-pressed',String(F.type==='egreso'));
  document.getElementById('tbI').setAttribute('aria-pressed',String(F.type==='ingreso'));
  var cats=F.type==='egreso'?CATS_E:CATS_I;
  var preserved=document.getElementById('categoryPreserved');
  preserved.hidden=!F.editId || F.cat===null || cats.some(function(cat){return cat.id===F.cat;});
  preserved.textContent=preserved.hidden?'':'Categoría actual: '+(F.cat||'Sin categoría')+'. Se conserva si no eliges otra.';
  document.getElementById('catRow').innerHTML=cats.map(function(c){var ic=getCatIcon(c.id);return '<button class="cat-pill'+(F.cat===c.id?' selected':'')+'" aria-pressed="'+(F.cat===c.id)+'" onclick="setCat(\''+c.id+'\')"><span class="ci" aria-hidden="true" style="background:'+ic.bg+'">'+ic.svg+'</span>'+esc(c.name)+'</button>';}).join('');
  document.getElementById('btnNext').disabled=!!F.amountError || !F.amount || Number(F.amount)<=0 || Number(F.amount)>1000000000000;
  document.getElementById('formBack').hidden=F.step!==2;
  if(F.step===2){
    var cat=cats.find(function(c){return c.id===F.cat;}) || {name:F.cat||'Sin categoría'};
    document.getElementById('chipZone').textContent=cat.name+' · '+fmtAmt(Number(F.amount));
  }
  document.getElementById('pbDName').textContent=S.names.d;
  document.getElementById('pbTName').textContent=S.names.t;
  ['d','t'].forEach(function(p){var button=document.getElementById(p==='d'?'pbD':'pbT');button.className='person-btn'+(F.person===p?' selected-person':'');button.setAttribute('aria-pressed',String(F.person===p));});
}
function setCat(id){F.cat=id;syncForm();}
function setAmount(raw){
  var entered=String(raw), text=entered.trim();
  // COP: enteros o grupos de miles completos; sólo se permiten centavos ,00.
  // Nunca borrar un signo o separador inválido y convertirlo en otra cantidad.
  var match=/^(?:(COP)\s*)?(?:\$\s*)?([1-9]\d{0,2}(?:\.\d{3})+|\d+)(?:,(00))?(?:\s*(COP))?$/i.exec(text);
  F.amountError=''; F.amountRaw='';
  if(!text) F.amount='';
  else if(match && !(match[1] && match[4])) F.amount=match[2].replace(/\./g,'').replace(/^0+(?=\d)/,'');
  else {
    F.amount=''; F.amountRaw=entered;
    F.amountError='Revisa el monto: usa 25000, $25.000 o 25.000,00; sin negativos ni centavos.';
  }
  document.getElementById('formError').textContent='';
  syncForm();
}
function kp(value){setAmount((F.amountError?'':F.amount)+value);}
function kdel(){setAmount((F.amountError?F.amountRaw:F.amount).slice(0,-1));}
function showFormError(error){document.getElementById('formError').textContent=error.message || 'No se pudo guardar. Tu formulario sigue aquí.';}
function saveTx(){
  if(F.submitted) return;
  var amount=Number(F.amount), input=document.getElementById('dateInput'), day=input.value;
  if(!Number.isSafeInteger(amount) || amount<=0){showFormError(new Error('Escribe un monto mayor que cero.'));return;}
  if(amount>1000000000000){showFormError(new Error('El monto máximo es $1.000.000.000.000.'));return;}
  if(!day || !input.checkValidity() || day<'1900-01-01' || day>localISO().slice(0,10)){showFormError(new Error('Selecciona una fecha válida, desde 1900 hasta hoy.'));input.focus();return;}
  if(F.cat===null) F.cat=F.type==='egreso'?'otros':'ingreso';
  var date=F.editId && day===F.originalDay?F.before.date:day===localISO().slice(0,10)?localISO():day+'T12:00:00';
  var tx={id:F.editId || (typeof crypto!=='undefined' && crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,10)),date:date,type:F.type,category:F.cat,description:document.getElementById('descInput').value.trim(),amount:amount,person:F.person};
  F.submitted=true;document.getElementById('saveTxBtn').disabled=true;
  try{
    var savedOperation=F.editId?opEditTx(tx,F.before):opAddTx(tx);
    try{lsSet('cajaLastPerson',F.person);}catch(e){}
    closeAll();
    toast(F.editId?(savedOperation===null?'No hay cambios por guardar.':'Cambios guardados aquí. Pendientes de sincronizar.'):'Guardado en este dispositivo. Pendiente de sincronizar.');
  }catch(error){F.submitted=false;document.getElementById('saveTxBtn').disabled=false;showFormError(error);}
}

/* ─── SWIPE TO DELETE (touch + pointer) ────────────────── */
var _swipedEl = null;
function resetSwipe(except){
  if (_swipedEl && _swipedEl !== except) {
    _swipedEl.style.transition = 'transform 0.22s cubic-bezier(0.4,0,0.2,1)';
    _swipedEl.style.transform = 'translateX(0)';
    _swipedEl = null;
  }
}
function initSwipeItems(){
  document.querySelectorAll('.tx-wrap').forEach(function(wrap){
    var item=wrap.querySelector('.tx-item'), del=wrap.querySelector('.tx-del'), id=wrap.dataset.id;
    var sx=0, sy=0, dx=0, active=false;
    item.addEventListener('pointerdown',function(e){if(e.target.closest('button'))return;sx=e.clientX;sy=e.clientY;dx=0;active=true;});
    item.addEventListener('pointermove',function(e){if(!active)return;dx=e.clientX-sx;if(Math.abs(e.clientY-sy)>Math.abs(dx)){active=false;return;}if(dx< -8){item.style.transform='translateX('+Math.max(-90,dx)+'px)';}});
    function end(){if(!active)return;active=false;if(dx< -36){resetSwipe(item);item.style.transform='translateX(-90px)';_swipedEl=item;del.tabIndex=0;}else{item.style.transform='';del.tabIndex=-1;}}
    item.addEventListener('pointerup',end);item.addEventListener('pointercancel',end);item.addEventListener('pointerleave',end);
    del.addEventListener('click',function(){delTx(id);});
    wrap.querySelector('.tx-menu').addEventListener('click',function(){editTx(id);});
  });
}

/* ─── ELIMINAR ─────────────────────────────────────────── */
var _pendingDelId = null;
function delTx(id){
  var tx = null;
  var txs = effectiveTxs();
  for (var i=0;i<txs.length;i++) if (txs[i].id===id) { tx = txs[i]; break; }
  if (!tx) return;
  var cats = tx.type==='ingreso' ? CATS_I : CATS_E;
  var cat = null;
  for (var j=0;j<cats.length;j++) if (cats[j].id===tx.category) { cat = cats[j]; break; }
  if (!cat) cat = cats[cats.length-1];
  document.getElementById('delConfirmText').textContent = (tx.description || cat.name) + (S.hideBalance ? '' : ' · ' + fmtAmt(tx.amount));
  document.getElementById('deleteError').textContent='';
  _pendingDelId = id;
  open_('deleteModal');
}
function confirmDelete(){
  if(!_pendingDelId)return;
  try{opDelTx(_pendingDelId);_pendingDelId=null;closeAll();toast('Eliminación guardada. Se sincronizará al conectar.');}
  catch(error){document.getElementById('deleteError').textContent=error.message || 'No se pudo guardar la eliminación.';}
}
function openSettings(){
  var cfg=effectiveConfig();
  document.getElementById('name1Input').value=cfg.name1;
  document.getElementById('name2Input').value=cfg.name2;
  document.getElementById('balInput').value=cfg.initialBalance;
  document.getElementById('settingsError').textContent='';
  var issue=document.getElementById('syncIssue');
  issue.textContent=S.sync && S.sync.lastError?'Sincronización: '+S.sync.lastError:'';
  issue.hidden=!issue.textContent;
  var idx=0;try{idx=parseInt(localStorage.getItem('cajaIconIdx')||'0',10);}catch(e){}
  document.getElementById('failedActionError').textContent='';
  renderFailedOperations();
  _syncIconPreview(idx);open_('settingsModal');
}
function failedOperationLabel(operation){
  if(operation.op==='addBatch')return 'Lote de '+operation.payload.transactions.length+' movimientos';
  if(operation.op==='setConfig')return 'Cambio de ajustes de la caja';
  var tx=(operation.op==='add' || operation.op==='edit')?operation.payload.tx:S.server.transactions.find(function(item){return item.id===operation.payload.id;});
  if(!tx)return 'Eliminación de movimiento';
  var prefix=operation.op==='edit'?'Edición':operation.op==='del'?'Eliminar':tx.type==='ingreso'?'Ingreso':'Gasto';
  var description=tx.description || categoryFor(tx).name;
  return prefix+' · '+description+(S.hideBalance?'':' · '+fmtAmt(tx.amount));
}
function renderFailedOperations(){
  var failed=S.outbox.filter(function(operation){return operation.status==='failed';});
  document.getElementById('failedPanel').hidden=!failed.length;
  document.getElementById('failedOperations').innerHTML=failed.map(function(operation){
    var details=operation.op==='addBatch'?operation.rows.filter(function(row){return row.status==='failed';}).map(function(row){var tx=operation.payload.transactions[row.index];return '<p>'+esc((tx.description || categoryFor(tx).name)+' · '+(row.error || 'El servidor rechazó este movimiento.'))+'</p>';}).join('')+'<p>Las filas confirmadas se conservan.</p>':'<p>'+esc(operation.error || 'El servidor rechazó este intento.')+'</p>';
    return '<div class="failed-operation"><strong>'+esc(failedOperationLabel(operation))+'</strong>'+details+'<button class="discard-btn" data-operation-id="'+esc(operation.id)+'">Descartar intento local</button></div>';
  }).join('');
}
function discardLocalAttempt(operationId){
  document.getElementById('failedActionError').textContent='';
  try{
    discardFailedOperation(operationId);
    renderFailedOperations();
    var issue=document.getElementById('syncIssue');
    issue.textContent=S.sync && S.sync.lastError?'Sincronización: '+S.sync.lastError:'';
    issue.hidden=!issue.textContent;
    document.getElementById('backupDownloadBtn').focus({preventScroll:true});
    toast('Intento descartado aquí. La hoja no cambió.');
  }catch(error){document.getElementById('failedActionError').textContent=error.message || 'No se pudo descartar el intento. Sigue guardado aquí.';}
}

function saveSettings(){
  var balanceInput=document.getElementById('balInput'), amount=Number(balanceInput.value);
  if(!Number.isSafeInteger(amount)){document.getElementById('settingsError').textContent='El saldo inicial debe ser un número entero de pesos.';balanceInput.focus();return;}
  var settings={name1:document.getElementById('name1Input').value.trim()||'Daniel',name2:document.getElementById('name2Input').value.trim()||'Thalía',initialBalance:amount};
  try{opSetConfig(settings);closeAll();toast('Ajustes guardados aquí. Pendientes de sincronizar.');}
  catch(error){document.getElementById('settingsError').textContent=error.message || 'No se pudieron guardar los ajustes.';}
}

/* ─── MODALES + TOAST ──────────────────────────────────── */
var _activeModal=null, _returnFocus=null;
function open_(id){
  var modal=document.getElementById(id);
  if(!_activeModal)_returnFocus=document.activeElement;
  document.querySelectorAll('.modal').forEach(function(other){other.classList.remove('open');other.inert=true;other.setAttribute('aria-hidden','true');});
  _activeModal=modal;modal.inert=false;modal.setAttribute('aria-hidden','false');modal.classList.add('open');modal.scrollTop=0;
  document.getElementById('app').inert=true;document.getElementById('quickActions').inert=true;
  document.getElementById('overlay').classList.add('open');document.body.classList.add('modal-open');
  var focus=modal.querySelector('[data-initial-focus]') || modal.querySelector('button,input');
  if(focus)focus.focus({preventScroll:true});
}
function closeAll(){
  if(typeof voiceOnClose==='function')voiceOnClose();
  document.querySelectorAll('.modal').forEach(function(modal){modal.classList.remove('open');modal.inert=true;modal.setAttribute('aria-hidden','true');});
  _activeModal=null;
  document.getElementById('app').inert=false;document.getElementById('quickActions').inert=false;
  document.getElementById('overlay').classList.remove('open');document.body.classList.remove('modal-open');
  resetSwipe(null);
  if(_returnFocus && _returnFocus.isConnected)_returnFocus.focus({preventScroll:true});
  _returnFocus=null;
}
function handleDialogKeyboard(event){
  if(!_activeModal)return;
  if(event.key==='Escape'){event.preventDefault();closeAll();return;}
  if(event.key!=='Tab')return;
  var controls=Array.from(_activeModal.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select,summary,a[href],[tabindex="0"]')).filter(function(el){return !el.hidden && el.getClientRects().length>0;});
  if(!controls.length){event.preventDefault();return;}
  var first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey && (document.activeElement===first || !_activeModal.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey && (document.activeElement===last || !_activeModal.contains(document.activeElement))){event.preventDefault();first.focus();}
}

function hideLoading(){
  var el = document.getElementById('loadingScreen');
  el.classList.add('hidden');
  setTimeout(function(){ el.style.display = 'none'; }, 400);
}
var _toastTimer = null;
function toast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2600);
}

/* ─── ICONO PWA (v1, conservado) ───────────────────────── */
var ICON_URLS=[
  'https://raw.githubusercontent.com/danielgoca01/caja-icons/main/caja_icon_0.jpg',
  'https://raw.githubusercontent.com/danielgoca01/caja-icons/main/caja_icon_1.jpg',
  null   // Símbolo de casa — generado localmente como PNG
];
var ICON_PHOTOS=[ICON_URLS[0], ICON_URLS[1], null];
var ICON_LABELS=['Foto 1','Foto 2','Símbolo de casa'];

function _liquidSVG(){
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
    +'<rect width="512" height="512" fill="#F4F1E8" rx="110"/>'
    +'<path d="M124 385V236a132 132 0 0 1 264 0v149z" fill="none" stroke="#526C4C" stroke-width="9"/>'
    +'<g fill="none" stroke="#526C4C" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="m180 252 76-60 76 60M195 241v98h122v-98M237 339v-62h38v62"/></g></svg>';
}

function initLiquidIcon(){
  // Cached on localStorage (después de la 1ra carga)
  var cached=null;try{cached=localStorage.getItem('cajaHouseIconPng');}catch(e){}
  if(cached){ ICON_URLS[2]=cached; ICON_PHOTOS[2]=cached; return; }
  try{
    var svg=_liquidSVG();
    var img=new Image();
    img.onload=function(){
      var c=document.createElement('canvas'); c.width=512; c.height=512;
      c.getContext('2d').drawImage(img,0,0);
      try{
        var uri=c.toDataURL('image/png');
        ICON_URLS[2]=uri; ICON_PHOTOS[2]=uri;
        localStorage.setItem('cajaHouseIconPng', uri);
        _syncIconPreview(parseInt(localStorage.getItem('cajaIconIdx')||'0',10));
      }catch(e){}
    };
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }catch(e){}
}

function initAppIcon(){
  try{initLiquidIcon();}catch(e){}
  var idx=0;try{idx=parseInt(localStorage.getItem('cajaIconIdx')||'0',10);}catch(e){}
  var l=document.getElementById('appIcon');
  if(l && ICON_URLS[idx]) l.href=ICON_URLS[idx];
  _syncIconPreview(idx);
}
function _syncIconPreview(idx){
  if(!Number.isInteger(idx) || idx<0 || idx>=ICON_URLS.length)idx=0;
  var p=document.getElementById('iconPreview');
  var lb=document.getElementById('iconLabel');
  if(p) p.src=ICON_PHOTOS[idx]||ICON_PHOTOS[0];
  if(lb) lb.textContent=ICON_LABELS[idx]+' · '+(idx+1)+' de '+ICON_URLS.length;
}
function cycleIcon(){
  var idx=0;try{idx=(parseInt(localStorage.getItem('cajaIconIdx')||'0',10)+1)%ICON_URLS.length;localStorage.setItem('cajaIconIdx',String(idx));}catch(e){toast('No se pudo guardar la preferencia del ícono.');return;}
  var l=document.getElementById('appIcon');
  if(l && ICON_URLS[idx]) l.href=ICON_URLS[idx];
  _syncIconPreview(idx);
  toast(ICON_LABELS[idx]+' seleccionado');
}


/* ─── INIT ─────────────────────────────────────────────── */
setInterval(function(){if(!document.hidden)checkVersion();},45000);
window.addEventListener('focus',  function(){ checkVersion(); drainOutbox(); });
window.addEventListener('online', function(){ drainOutbox(); checkVersion(); });
document.addEventListener('keydown', handleDialogKeyboard);
document.getElementById('failedOperations').addEventListener('click',function(event){var button=event.target.closest('[data-operation-id]');if(button)discardLocalAttempt(button.dataset.operationId);});
window.addEventListener('resize', initSeg);
document.getElementById('amountInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();goStep2();}});

initTheme();
renderApGrid();
initAppIcon();
initSeg();
boot();
if('serviceWorker' in navigator && location.hostname!=='127.0.0.1' && location.hostname!=='localhost'){
  window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});
}
