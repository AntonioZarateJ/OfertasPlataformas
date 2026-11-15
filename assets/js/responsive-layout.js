// Mover los mismos controles conserva sus eventos, valores y lógica.
sortContainer.parentElement.classList.add('desktop-filter-actions');
const mobileLayout = matchMedia('(max-width: 767px)');
const mobileFilterPanel = document.getElementById('mobileFilterPanel');
const responsiveControls = [
 document.querySelector('.region-control'),
 currencySelect.parentElement,
 document.getElementById('pcStoreBar'),
 sortContainer,
 toggleFineTuneBtn,
 fineTuneDrawer,
 document.getElementById('consoleTools'),
 document.getElementById('freeGamesSubBar'),
 document.getElementById('catalogScopeNote')
].map(element=>{
 const anchor=document.createComment('posición de escritorio');
 element.before(anchor);return {element,anchor};
});
function applyResponsiveLayout(){
 const container=document.getElementById('mobileFilterContent');
 for(const {element,anchor} of responsiveControls){
  if(mobileLayout.matches)container.appendChild(element);
  else anchor.after(element);
 }
 document.getElementById('mobileRegionLabel').textContent=purchaseRegions[currentRegion][0];
}
document.getElementById('closeMobileFilters').addEventListener('click', () => {
 mobileFilterPanel.open = false;
 mobileFilterPanel.querySelector('summary').focus();
});
mobileLayout.addEventListener('change',applyResponsiveLayout);
document.getElementById('regionSelect').addEventListener('change',()=>{document.getElementById('mobileRegionLabel').textContent=purchaseRegions[currentRegion][0];});
applyResponsiveLayout();
