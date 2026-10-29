let comparisonController;
let comparisonSelection;
function closeConsoleComparison(){comparisonController?.abort();document.getElementById('consoleComparison').close();}
async function openConsoleComparison(item,platform=activeEcosystem,region=currentRegion){
 comparisonController?.abort();
 comparisonSelection=item;
 const controller=new AbortController();comparisonController=controller;
 const modal=document.getElementById('consoleComparison');
 const content=document.getElementById('consoleComparisonBody');
 modal.dataset.platform=platform;
 document.querySelector('.comparison-heading>div>p').innerHTML=`<i class="${ECOSYSTEM_META[platform].icon}"></i> ${escapeHTML(ECOSYSTEM_META[platform].name)} · COMPARAR PRECIOS`;
 document.getElementById('consoleComparisonTitle').textContent=item.title;
 document.querySelector('.comparison-poster')?.remove();
 if(safeURL(item.image)){const poster=document.createElement('img');poster.className='comparison-poster';poster.src=safeURL(item.image);poster.alt='';document.querySelector('.comparison-heading').prepend(poster);}
 if(!modal.open)modal.showModal();
 content.innerHTML='<p class="comparison-state" role="status">Consultando opciones para esta edición y región…</p>';
 try{
  const params=new URLSearchParams({platform,region,title:item.title,id:item.id,store:item.store});
  const data=await requestJSON('/api/console-comparison?'+params,{signal:controller.signal,timeout:18000});
  if(controller.signal.aborted)return;
  const format=q=>new Intl.NumberFormat('es-MX',{style:'currency',currency:q.currency}).format(q.price)+' '+q.currency;
  const row=q=>`<article class="comparison-row ${q.kind==='official'?'comparison-official':''}"><div><strong><i class="fa-solid ${q.kind==='official'?'fa-store':'fa-key'}"></i> ${escapeHTML(q.store)}</strong><span>${q.kind==='official'?'Tienda oficial':'Mercado externo · revisar cargos finales'}</span><p>${escapeHTML(q.title)}</p><small>${escapeHTML(q.edition||'')}</small></div><div class="comparison-cost"><strong>${escapeHTML(format(q))}</strong><a href="${escapeHTML(safeURL(q.url))}" target="_blank" rel="noopener noreferrer">Ir a la tienda ↗</a></div></article>`;
  const official=data.offers.filter(q=>q.kind==='official');
  const external=data.offers.filter(q=>q.kind==='external');
  let html=`<p class="comparison-context">${escapeHTML(ECOSYSTEM_META[data.platform].name)} · Región ${escapeHTML(purchaseRegions[data.region][0])} · Consulta ${escapeHTML(new Date(data.checkedAt).toLocaleTimeString('es-MX'))}</p>`;
  const bestOfficial=[...official].sort((a,b)=>a.price-b.price)[0];
  const bestExternal=[...external].sort((a,b)=>a.price-b.price)[0];
  const observations=data.offers.filter(q=>q.history?.days>1);
  html+=`<div class="comparison-metrics"><div class="metric-official"><span><i class="fa-solid fa-store"></i> Mejor oficial consultado</span><strong>${bestOfficial?escapeHTML(format(bestOfficial)):'No confirmado'}</strong><small>Esta edición y región</small></div><div class="metric-external"><span><i class="fa-solid fa-key"></i> Mejor externo consultado</span><strong>${bestExternal?escapeHTML(format(bestExternal)):'Sin coincidencias'}</strong><small>Antes de posibles cargos</small></div><div class="metric-history"><span><i class="fa-solid fa-clock-rotate-left"></i> Registro observado</span><strong>${observations.length?escapeHTML(format({...observations[0],price:Math.min(...observations.filter(q=>q.currency===observations[0].currency).map(q=>q.history.min))})):'En construcción'}</strong><small>${observations.length?'Mínimo del registro propio':'Aún no hay suficientes días'}</small></div></div>`;
  html+='<h3><i class="fa-solid fa-scale-balanced"></i> Opciones para esta edición</h3>';
  html+=official.length?official.map(row).join(''):'<p class="comparison-state">No pudimos confirmar una oferta oficial de esta edición en esta consulta.</p>';
  html+=external.length?external.map(row).join(''):'<p class="comparison-state">No encontramos otras ofertas verificadas de esta edición en las fuentes consultadas. Esto no significa que no exista en otras tiendas.</p>';
  html+='<h3>Registro de precios de esta web</h3><div class="comparison-history">';
  for(const q of data.offers){
   const h=q.history;
   html+=`<div><strong>${escapeHTML(q.store)}</strong><p>${h?.days>1?'Mínimo observado: '+escapeHTML(format({...q,price:h.min}))+' · Máximo observado: '+escapeHTML(format({...q,price:h.max})):'Historial insuficiente: apenas iniciamos el registro de este producto.'}</p>${h?`<small>Desde ${escapeHTML(h.since)} · ${h.days} día(s) con observaciones. ${h.persistent===false?'Registro temporal en memoria.':''}</small>`:''}</div>`;
  }
  html+='</div><p class="comparison-note">El registro depende de nuestras consultas; no representa el mínimo o máximo histórico absoluto del mercado.</p>';
  if(data.otherEditions.length)html+=`<details><summary>Otras ediciones y variantes · no se mezclan en la comparación</summary>${data.otherEditions.map(row).join('')}</details>`;
  html+='<details><summary>Consultar más tiendas</summary><p class="comparison-note">Enlaces de búsqueda sin precio verificado. Comprueba que sea un juego completo, una clave y la región correcta; evita cuentas y claves aleatorias.</p><div class="comparison-links">'+data.searchLinks.map(link=>`<a href="${escapeHTML(safeURL(link.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.name)} ↗</a>`).join('')+'</div></details>';
  html+='<p class="comparison-note">'+escapeHTML(data.coverage)+'</p><div class="comparison-sources">'+data.sources.map(s=>`<span>${escapeHTML(s.name)}: ${s.status==='ok'?'consulta completada':s.status==='skipped'?'no consultada':'no se pudo consultar'}</span>`).join('')+'</div>';
  content.innerHTML=html;
  const fresh=data.offers.find(q=>String(q.id)===String(item.id)&&q.store===item.store&&q.currency===item.currency);
  addConsoleSaveControls(content,{...item,...fresh,checkedAt:fresh?data.checkedAt:item.checkedAt},platform,region);
 }catch(error){if(!controller.signal.aborted){content.innerHTML='<p class="comparison-state">No se pudo completar la comparación.</p><button class="console-compare" type="button" id="retryComparison">Reintentar</button>';document.getElementById('retryComparison').onclick=()=>openConsoleComparison(item,platform,region);}}
}
document.getElementById('consoleComparison').addEventListener('cancel',()=>comparisonController?.abort());
