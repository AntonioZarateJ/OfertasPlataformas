let comparisonController;
let comparisonSelection;
function closeConsoleComparison(){comparisonController?.abort();document.getElementById('consoleComparison').close();}
async function openConsoleComparison(item){
 comparisonController?.abort();
 comparisonSelection=item;
 const controller=new AbortController();comparisonController=controller;
 const modal=document.getElementById('consoleComparison');
 const content=document.getElementById('consoleComparisonBody');
 document.getElementById('consoleComparisonTitle').textContent=item.title;
 if(!modal.open)modal.showModal();
 content.innerHTML='<p class="comparison-state" role="status">Consultando opciones para esta edición y región…</p>';
 try{
  const params=new URLSearchParams({platform:activeEcosystem,region:currentRegion,title:item.title,id:item.id,store:item.store});
  const data=await requestJSON('/api/console-comparison?'+params,{signal:controller.signal,timeout:18000});
  if(controller.signal.aborted)return;
  const format=q=>new Intl.NumberFormat('es-MX',{style:'currency',currency:q.currency}).format(q.price)+' '+q.currency;
  const row=q=>`<article class="comparison-row ${q.kind==='official'?'comparison-official':''}"><div><strong>${escapeHTML(q.store)}</strong><span>${q.kind==='official'?'Tienda oficial':'Mercado externo · revisar cargos finales'}</span><p>${escapeHTML(q.title)}</p><small>${escapeHTML(q.edition||'')}</small></div><div class="comparison-cost"><strong>${escapeHTML(format(q))}</strong><a href="${escapeHTML(safeURL(q.url))}" target="_blank" rel="noopener noreferrer">Ir a la tienda ↗</a></div></article>`;
  const official=data.offers.filter(q=>q.kind==='official');
  const external=data.offers.filter(q=>q.kind==='external');
  let html=`<p class="comparison-context">${escapeHTML(ECOSYSTEM_META[data.platform].name)} · Región ${escapeHTML(purchaseRegions[data.region][0])} · Consulta ${escapeHTML(new Date(data.checkedAt).toLocaleTimeString('es-MX'))}</p>`;
  html+='<h3>Esta edición · tiendas oficiales primero</h3>';
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
 }catch(error){if(!controller.signal.aborted){content.innerHTML='<p class="comparison-state">No se pudo completar la comparación.</p><button class="console-compare" type="button" id="retryComparison">Reintentar</button>';document.getElementById('retryComparison').onclick=()=>openConsoleComparison(item);}}
}
document.getElementById('consoleComparison').addEventListener('cancel',()=>comparisonController?.abort());
