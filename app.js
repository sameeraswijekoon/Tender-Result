const items = document.querySelector('#items');
const itemTemplate = document.querySelector('#itemTemplate');
const bidderTemplate = document.querySelector('#bidderTemplate');
const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 });
const num = value => Number(value) || 0;
function normalizeSearch(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
const storageKey = 'abansTenderDraft';
const firebaseUrl = 'https://tender-reading-management-default-rtdb.firebaseio.com';
const defaultAccountHolders = ['Monique','Mahesh','Vithushan','Keshan','Sathsara','Kanchana','Dinith','Yoshitha','Harsha','Sanula','Lasitha','Humaid','Thilini'];
let sharedAccountHolders = [...defaultAccountHolders];
function renderAccountHolders() {
  const list = document.querySelector('#accountHolders');
  if (!list) return;
  list.innerHTML = sharedAccountHolders.map(name => `<option value="${name.replaceAll('&','&amp;').replaceAll('"','&quot;')}"></option>`).join('');
}
async function loadAccountHolders() {
  // Shared list = built-in names + every account holder name already saved on a
  // Firebase tender. The database rules only open the tenders path, so names are
  // shared through the tender records themselves: a new name typed on a tender
  // becomes visible to everyone as soon as that tender is saved.
  try {
    const response = await fetch(`${firebaseUrl}/tenders.json`);
    if (!response.ok) return;
    const data = await response.json() || {};
    const merged = [...defaultAccountHolders];
    Object.values(data).forEach(tender => { const clean = String((tender && tender.accountHolderName) || '').trim(); if (clean && !merged.some(item => item.toLowerCase() === clean.toLowerCase())) merged.push(clean); });
    sharedAccountHolders = merged;
    renderAccountHolders();
  } catch (error) { /* keep the built-in list when Firebase is unreachable */ }
}
async function shareAccountHolder(name) {
  // No separate write needed: saveCloud stores this name on the tender itself,
  // and loadAccountHolders picks it up from there for everyone else.
  const clean = String(name || '').trim();
  if (!clean || sharedAccountHolders.some(item => item.toLowerCase() === clean.toLowerCase())) return;
  sharedAccountHolders = [...sharedAccountHolders, clean];
  renderAccountHolders();
}
let cloudTenderId = localStorage.getItem('abansCloudTenderId') || '';
let cloudCreatedAt = localStorage.getItem('abansCloudCreatedAt') || '';
let offlineTenderId = localStorage.getItem('abansOfflineTenderId') || '';
let isRestoring = false;
let allCloudTenders = [];
const mataleTender = {
  customerName: 'General Hospital - Matale', accountHolderName: '', closingDate: '', cloudTenderId: '', createdAt: '',
  cards: [
    { name: 'Laptop', qty: 20, category: 'Laptop', model: 'Lenovo ThinkBook 16G', processor: '', ram: '', storage: '', display: '', warranty: '', abansUnit: '483900', abansTotal: '', bidders: [
      { name: 'Base HP', model: 'Asus Expert', unit: '353000', total: '' }, { name: 'SMA Technology', model: 'HP 4G1126', unit: '354500', total: '' }, { name: 'Paper Line Tech Kandy', model: 'Lenovo V15', unit: '317900', total: '' }, { name: 'Metro', model: 'Acer TP215', unit: '459881', total: '' }, { name: 'Gestner', model: 'Lenovo V15', unit: '279695', total: '' }, { name: 'Micro Technology', model: 'HP Pro G11', unit: '375000', total: '' }
    ] },
    { name: 'Desktop PC', qty: 7, category: 'Desktop', model: 'Lenovo Neo', processor: '', ram: '', storage: '', display: '', warranty: '', abansUnit: '465000', abansTotal: '', bidders: [
      { name: 'Base HP', model: 'Dell Pro 1250', unit: '398000', total: '' }, { name: 'SMA Technology', model: 'HP Pro Tower', unit: '345900', total: '' }, { name: 'Gestner', model: 'Lenovo ThinkBook Neo 50T', unit: '354915', total: '' }, { name: 'Micro Technology', model: 'HP Pro Tower G4', unit: '348000', total: '' }
    ] },
    { name: 'Mini PC', qty: 200, category: 'Desktop', model: '', processor: '', ram: '', storage: '', display: 'Monitor', warranty: '', abansUnit: '325000', abansTotal: '', bidders: [
      { name: 'Telasis', model: 'Kmips M100 with monitor (no brand)', unit: '187095', total: '' }, { name: 'CBA', model: 'G Com Mini12', unit: '174950', total: '' }, { name: 'SMA Technology', model: 'SG 100 with monitor (no brand)', unit: '127222', total: '' }, { name: 'Sampath IT', model: 'Asus PM43', unit: '178696', total: '' }, { name: 'Metro', model: 'Acer RB 102', unit: '267310', total: '' }, { name: 'Gestner', model: 'Yuhua with monitor', unit: '235800', total: '' }, { name: 'Sumathi IT', model: 'Hijln T12D', unit: '152964', total: '' }
    ] }
  ]
};

function saveData() {
  if (isRestoring) return;
  const data = {
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    cloudTenderId,
    createdAt: cloudCreatedAt,
    customerName: document.querySelector('#customerName').value,
    accountHolderName: document.querySelector('#accountHolderName').value,
    closingDate: document.querySelector('#closingDate').value,
    cards: [...items.children].map(card => ({
      name: card.querySelector('.item-name').value, qty: card.querySelector('.item-qty').value,
      category: card.querySelector('.category').value, model: card.querySelector('.model').value,
      processor: card.querySelector('.processor').value, ram: card.querySelector('.ram').value,
      storage: card.querySelector('.storage').value, display: card.querySelector('.display').value,
      warranty: card.querySelector('.warranty').value,
      localPurchase1: card.querySelector('.local-purchase-1').value, localPurchase2: card.querySelector('.local-purchase-2').value, localPurchase3: card.querySelector('.local-purchase-3').value,
      ramNormalized: normalizeSearch(card.querySelector('.ram').value),
      processorNormalized: normalizeSearch(card.querySelector('.processor').value),
      storageNormalized: normalizeSearch(card.querySelector('.storage').value),
      displayNormalized: normalizeSearch(card.querySelector('.display').value),
      warrantyNormalized: normalizeSearch(card.querySelector('.warranty').value),
      searchTextNormalized: normalizeSearch([
        card.querySelector('.item-name').value, card.querySelector('.category').value,
        card.querySelector('.model').value, card.querySelector('.processor').value,
        card.querySelector('.ram').value, card.querySelector('.storage').value,
        card.querySelector('.display').value, card.querySelector('.warranty').value,
        card.querySelector('.local-purchase-1').value, card.querySelector('.local-purchase-2').value,
        card.querySelector('.local-purchase-3').value,
        ...[...card.querySelectorAll('.bidder-row')].flatMap(row => [row.querySelector('.bidder-name').value, row.querySelector('.bidder-model').value])
      ].join(' ')),
      abansUnit: card.querySelector('.abans-unit').value,
      abansTotal: card.querySelector('.abans-total').value,
      bidders: [...card.querySelectorAll('.bidder-row')].map(row => ({ name: row.querySelector('.bidder-name').value, model: row.querySelector('.bidder-model').value, unit: row.querySelector('.bidder-unit').value, total: row.querySelector('.bidder-total').value }))
    }))
  };
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function restoreData() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (!saved || saved.expiresAt <= Date.now()) { localStorage.removeItem(storageKey); return false; }
  cloudTenderId = saved.cloudTenderId || cloudTenderId;
  cloudCreatedAt = saved.createdAt || cloudCreatedAt;
  isRestoring = true;
  document.querySelector('#customerName').value = saved.customerName || '';
  document.querySelector('#accountHolderName').value = saved.accountHolderName || '';
  document.querySelector('#closingDate').value = saved.closingDate || '';
  saved.cards.forEach(data => {
    addItem(); const card = items.lastElementChild;
    card.querySelector('.item-name').value = data.name || '';
    card.querySelector('.item-qty').value = data.qty || 1;
    ['category','model','processor','ram','storage','display','warranty'].forEach(field => card.querySelector(`.${field}`).value = data[field] || '');
    card.querySelector('.local-purchase-1').value = data.localPurchase1 || '';
    card.querySelector('.local-purchase-2').value = data.localPurchase2 || '';
    card.querySelector('.local-purchase-3').value = data.localPurchase3 || '';
    card.querySelector('.abans-unit').value = data.abansUnit || '';
    card.querySelector('.abans-total').value = data.abansTotal || '';
    card.querySelector('.bidder-list').innerHTML = '';
    (data.bidders || []).forEach(bidder => { addBidder(card); const row = card.querySelector('.bidder-list').lastElementChild; row.querySelector('.bidder-name').value = bidder.name || ''; row.querySelector('.bidder-model').value = bidder.model || ''; row.querySelector('.bidder-unit').value = bidder.unit || ''; row.querySelector('.bidder-total').value = bidder.total || ''; });
  });
  isRestoring = false; updateTotalQty(); renumber(); renderResults(); return true;
}

function itemQty(card) { return Math.max(1, num(card.querySelector('.item-qty').value)); }
function updateTotalQty() { document.querySelector('#totalQty').value = [...items.querySelectorAll('.item-qty')].reduce((sum, input) => sum + num(input.value), 0); }

function updatePair(card, edited, unit, total) {
  if (edited === unit && unit.value !== '') total.value = (num(unit.value) * itemQty(card)).toFixed(2);
  if (edited === total && total.value !== '') unit.value = (num(total.value) / itemQty(card)).toFixed(2);
  renderResults();
}

function bindPricePair(card, scope, unitSelector, totalSelector) {
  const unit = scope.querySelector(unitSelector);
  const total = scope.querySelector(totalSelector);
  [unit, total].forEach(input => ['input', 'change', 'blur'].forEach(event => input.addEventListener(event, e => updatePair(card, e.target, unit, total))));
}

function recalculateTotals(card) {
  const quantity = itemQty(card);
  const abansUnit = card.querySelector('.abans-unit');
  if (abansUnit.value !== '') card.querySelector('.abans-total').value = (num(abansUnit.value) * quantity).toFixed(2);
  card.querySelectorAll('.bidder-row').forEach(row => {
    const unit = row.querySelector('.bidder-unit');
    if (unit.value !== '') row.querySelector('.bidder-total').value = (num(unit.value) * quantity).toFixed(2);
  });
}

function addBidder(card) {
  const row = bidderTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector('.bidder-list').append(row);
  row.querySelector('.remove-bidder').onclick = () => { row.remove(); renderResults(); };
  bindPricePair(card, row, '.bidder-unit', '.bidder-total');
}

function renumber() {
  [...items.children].forEach((card, i) => card.querySelector('.item-number').textContent = `ITEM ${String(i + 1).padStart(2, '0')}`);
  document.querySelector('#emptyState').style.display = items.children.length ? 'none' : 'block';
}

function addItem() {
  if (items.children.length >= 20) return alert('You can add a maximum of 20 tender items.');
  const card = itemTemplate.content.firstElementChild.cloneNode(true);
  const number = items.children.length + 1;
  card.querySelector('.item-name').value = `Item ${String(number).padStart(2, '0')}`;
  items.append(card);
  addBidder(card);
  card.querySelector('.add-bidder').onclick = () => addBidder(card);
  card.querySelector('.remove-item').onclick = () => { card.remove(); renumber(); updateTotalQty(); renderResults(); };
  ['input', 'change', 'blur'].forEach(event => card.querySelector('.item-qty').addEventListener(event, () => { updateTotalQty(); recalculateTotals(card); renderResults(); }));
  bindPricePair(card, card, '.abans-unit', '.abans-total');
  card.addEventListener('input', renderResults);
  renumber(); updateTotalQty(); renderResults();
}

function renderResults() {
  const target = document.querySelector('#results');
  const empty = document.querySelector('#resultEmpty');
  target.innerHTML = '';
  [...items.children].forEach((card, index) => {
    recalculateTotals(card);
    const quotes = [];
    const abansUnit = num(card.querySelector('.abans-unit').value);
    if (abansUnit) quotes.push({ name: 'Abans Computer', model: card.querySelector('.model').value || '-', unit: abansUnit, total: num(card.querySelector('.abans-total').value), isAbans: true });
    card.querySelectorAll('.bidder-row').forEach(row => {
      const unit = num(row.querySelector('.bidder-unit').value);
      if (unit) quotes.push({ name: row.querySelector('.bidder-name').value || 'Unnamed Bidder', model: row.querySelector('.bidder-model').value || '-', unit, total: num(row.querySelector('.bidder-total').value) });
    });
    if (!quotes.length) return;
    quotes.sort((a, b) => a.unit - b.unit);
    const lowestPrice = quotes[0].unit;
    const rows = quotes.map((quote, rank) => {
      const gap = quote.isAbans ? quote.unit - lowestPrice : null;
      const label = `L${rank + 1}`;
      const gapPct = gap !== null && lowestPrice ? (gap / lowestPrice * 100).toFixed(1) : null;
      const gapText = gap === null ? '-' : gap === 0 ? 'Lowest bid' : `${fmt.format(gap)} (${gapPct}%) above lowest`;
      return `<tr><td class="${rank === 0 ? 'lowest' : ''}"><span class="rank ${rank === 0 ? 'rank-l1' : ''}">${label}</span>${quote.name}${rank === 0 ? ' (Lowest)' : ''}</td><td>${quote.model}</td><td class="money">${fmt.format(quote.unit)}</td><td class="money">${fmt.format(quote.total)}</td><td class="money ${gap > 0 ? 'gap-positive' : gap < 0 ? 'gap-negative' : ''}">${gapText}</td></tr>`;
    }).join('');
    const name = card.querySelector('.item-name').value || `Item ${index + 1}`;
    target.insertAdjacentHTML('beforeend', `<div class="result-item"><div class="result-title">${name}<span>Qty: ${itemQty(card)}</span></div><table class="result-table"><thead><tr><th>Bidder</th><th>Model</th><th class="money">Unit Price</th><th class="money">Total Price</th><th class="money">Abans Price Gap</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  });
  empty.style.display = target.children.length ? 'none' : 'block';
  saveData();
}

function setCloudStatus(message, isError = false) {
  const status = document.querySelector('#cloudStatus');
  status.textContent = message;
  status.style.color = isError ? '#c53030' : '';
}

function saveOfflineTender(data) {
  const records = JSON.parse(localStorage.getItem('abansOfflineTenders') || '[]');
  if (!offlineTenderId) { offlineTenderId = `local-${Date.now()}`; localStorage.setItem('abansOfflineTenderId', offlineTenderId); }
  const record = { ...data, id: offlineTenderId, source: 'browser', updatedAt: new Date().toISOString() };
  const index = records.findIndex(item => item.id === offlineTenderId);
  if (index >= 0) records[index] = record; else records.push(record);
  localStorage.setItem('abansOfflineTenders', JSON.stringify(records));
}

async function saveCloud(status) {
  if (!document.querySelector('#customerName').value.trim()) return alert('Enter the customer name before saving to Firebase.');
  saveData();
  const data = JSON.parse(localStorage.getItem(storageKey));
  delete data.expiresAt;
  data.status = status;
  data.updatedAt = new Date().toISOString();
  if (!data.createdAt) { cloudCreatedAt = new Date().toISOString(); localStorage.setItem('abansCloudCreatedAt', cloudCreatedAt); data.createdAt = cloudCreatedAt; }
  setCloudStatus('Saving to Firebase...');
  await shareAccountHolder(data.accountHolderName);
  try {
    const url = cloudTenderId ? `${firebaseUrl}/tenders/${cloudTenderId}.json` : `${firebaseUrl}/tenders.json`;
    const response = await fetch(url, { method: cloudTenderId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Firebase rejected the request');
    if (!cloudTenderId) { cloudTenderId = (await response.json()).name; localStorage.setItem('abansCloudTenderId', cloudTenderId); }
    saveData();
    setCloudStatus(status === 'final' ? 'Final tender saved to Firebase' : 'Temporary cloud draft saved — continue later from any device');
  } catch (error) { setCloudStatus('Could not save to Firebase. Check database rules and internet connection.', true); }
}

async function openCloudTender(id) {
  try {
    setCloudStatus('Loading cloud tender...');
    const response = await fetch(`${firebaseUrl}/tenders/${id}.json`);
    if (!response.ok) throw new Error('Unable to load');
    const data = await response.json();
    if (!data) throw new Error('Tender not found');
    cloudTenderId = id; localStorage.setItem('abansCloudTenderId', id);
    cloudCreatedAt = data.createdAt || ''; localStorage.setItem('abansCloudCreatedAt', cloudCreatedAt);
    data.expiresAt = Date.now() + 2 * 60 * 60 * 1000; data.cloudTenderId = id;
    localStorage.setItem(storageKey, JSON.stringify(data));
    items.innerHTML = '';
    restoreData();
    setCloudStatus('Cloud tender loaded. Local copy will clear after 2 hours.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) { setCloudStatus('Could not load this tender from Firebase.', true); }
}

function analyseTender(tender) {
  const comparisons = (tender.cards || []).map(card => {
    const quotes = [];
    if (num(card.abansUnit)) quotes.push({ name: 'Abans Computer', unit: num(card.abansUnit), isAbans: true });
    (card.bidders || []).forEach(bidder => { if (num(bidder.unit)) quotes.push({ name: bidder.name || 'Unnamed Bidder', unit: num(bidder.unit) }); });
    quotes.sort((a, b) => a.unit - b.unit);
    const abans = quotes.find(quote => quote.isAbans);
    return { lowest: quotes[0], abansGap: abans && quotes[0] ? abans.unit - quotes[0].unit : null };
  }).filter(result => result.lowest);
  const winnerCounts = {};
  comparisons.forEach(result => winnerCounts[result.lowest.name] = (winnerCounts[result.lowest.name] || 0) + 1);
  const winner = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1])[0];
  const gaps = comparisons.map(result => result.abansGap).filter(gap => gap !== null);
  return { comparisons, winner: winner ? `${winner[0]} (${winner[1]} L1)` : '-', avgGap: gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : null, abansL1: comparisons.filter(result => result.lowest.name === 'Abans Computer').length };
}

function renderDashboard() {
  const records = document.querySelector('#cloudRecords');
  const summary = document.querySelector('#reportSummary');
  const term = normalizeSearch(document.querySelector('#reportSearch').value);
  const status = document.querySelector('#reportStatus').value;
  const from = document.querySelector('#reportFrom').value;
  const to = document.querySelector('#reportTo').value;
  const tenders = allCloudTenders.filter(tender => {
    const haystack = normalizeSearch(`${tender.customerName || ''} ${tender.accountHolderName || ''} ${(tender.cards || []).map(card => card.searchTextNormalized || [card.name, card.category, card.model, card.processor, card.ram, card.storage, card.display, card.warranty, card.localPurchase1, card.localPurchase2, card.localPurchase3, ...(card.bidders || []).flatMap(bidder => [bidder.name, bidder.model])].join(' ')).join(' ')}`);
    const date = String(tender.updatedAt || '').slice(0, 10);
    return (!term || haystack.includes(term)) && (status === 'all' || tender.status === status) && (!from || date >= from) && (!to || date <= to);
  });
  const finalCount = tenders.filter(tender => tender.status === 'final').length;
  const itemCount = tenders.reduce((sum, tender) => sum + (tender.cards || []).length, 0);
  const analysis = tenders.map(analyseTender);
  const comparedItems = analysis.reduce((sum, item) => sum + item.comparisons.length, 0);
  const abansL1 = analysis.reduce((sum, item) => sum + item.abansL1, 0);
  const avgGapValues = analysis.map(item => item.avgGap).filter(value => value !== null);
  const avgGap = avgGapValues.length ? avgGapValues.reduce((sum, value) => sum + value, 0) / avgGapValues.length : null;
  summary.innerHTML = `<span><strong>${tenders.length}</strong> tenders shown</span><span><strong>${finalCount}</strong> final tenders</span><span><strong>${itemCount}</strong> tender items</span><span><strong>${comparedItems}</strong> price comparisons</span>`;
  const max = Math.max(tenders.length, 1);
  document.querySelector('#statusChart').innerHTML = `<div class="bar-row"><span>Final</span><div class="bar-track"><div class="bar-fill final" style="width:${finalCount / max * 100}%"></div></div><strong>${finalCount}</strong></div><div class="bar-row"><span>Draft</span><div class="bar-track"><div class="bar-fill" style="width:${(tenders.length - finalCount) / max * 100}%"></div></div><strong>${tenders.length - finalCount}</strong></div>`;
  document.querySelector('#competitionInsights').innerHTML = `<div class="insight"><span>Abans ranked L1</span><strong>${abansL1} / ${comparedItems || 0} items</strong></div><div class="insight"><span>Average Abans unit-price gap</span><strong>${avgGap === null ? '-' : fmt.format(avgGap)}</strong></div><div class="insight"><span>Completion rate</span><strong>${tenders.length ? Math.round(finalCount / tenders.length * 100) : 0}%</strong></div>`;
  records.innerHTML = '';
  if (!tenders.length) { records.innerHTML = '<tr><td colspan="7" class="table-empty">No tenders match the selected filters.</td></tr>'; return; }
  tenders.forEach(tender => {
    const insight = analyseTender(tender); const row = document.createElement('tr');
    row.innerHTML = `<td><strong>${tender.customerName || 'Unnamed customer'}</strong><p>${(tender.cards || []).map(card => card.name || 'Unnamed item').slice(0, 2).join(', ')}${(tender.cards || []).length > 2 ? '…' : ''}</p></td><td><span class="status-${tender.status === 'final' ? 'final' : 'draft'}">${tender.status === 'final' ? 'FINAL' : 'DRAFT'}</span></td><td>${(tender.cards || []).length}</td><td>${insight.winner}</td><td class="${insight.avgGap > 0 ? 'gap-positive' : ''}">${insight.avgGap === null ? '-' : fmt.format(insight.avgGap)}</td><td>${tender.updatedAt ? new Date(tender.updatedAt).toLocaleString() : '-'}</td><td><button class="button small">Open</button></td>`;
    row.querySelector('button').onclick = () => openCloudTender(tender.id); records.append(row);
  });
}

async function loadCloudRecords() {
  document.querySelector('#reportSummary').textContent = 'Loading tender report...';
  try {
    const response = await fetch(`${firebaseUrl}/tenders.json`);
    if (!response.ok) throw new Error('Unable to load records');
    const data = await response.json() || {};
    allCloudTenders = Object.entries(data).map(([id, tender]) => ({ id, ...tender })).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    renderDashboard();
  } catch (error) { document.querySelector('#reportSummary').textContent = 'Could not load Firebase records. Check database rules and internet connection.'; }
}

function generateImage() {
  const cards = [...items.children];
  const resultCards = cards.map((card, index) => {
    const quotes = [];
    const abansUnit = num(card.querySelector('.abans-unit').value);
    if (abansUnit) quotes.push({ name: 'Abans Computer', model: card.querySelector('.model').value || '-', unit: abansUnit, total: num(card.querySelector('.abans-total').value), isAbans: true });
    card.querySelectorAll('.bidder-row').forEach(row => { const unit = num(row.querySelector('.bidder-unit').value); if (unit) quotes.push({ name: row.querySelector('.bidder-name').value || 'Unnamed Bidder', model: row.querySelector('.bidder-model').value || '-', unit, total: num(row.querySelector('.bidder-total').value) }); });
    quotes.sort((a, b) => a.unit - b.unit);
    return { name: card.querySelector('.item-name').value || `Item ${index + 1}`, qty: itemQty(card), quotes };
  }).filter(item => item.quotes.length);
  if (!resultCards.length) return alert('Enter at least one bidder unit price before generating the image.');
  const width = 1500, rowHeight = 52;
  const height = 150 + resultCards.reduce((sum, item) => sum + 126 + (item.quotes.length * rowHeight), 0);
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2); ctx.fillStyle = '#f4f7fb'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#102a43'; ctx.font = 'bold 24px Segoe UI'; ctx.fillText(document.querySelector('#customerName').value || 'Customer: Not entered', 55, 48);
  ctx.font = '18px Segoe UI'; ctx.fillStyle = '#486581'; ctx.fillText(`Account Holder: ${document.querySelector('#accountHolderName').value || '-'}`, 55, 78); ctx.fillText(`Closing Date: ${document.querySelector('#closingDate').value || '-'}`, 55, 105);
  let y = 130;
  resultCards.forEach(item => {
    const blockHeight = 126 + item.quotes.length * rowHeight;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(45, y, width - 90, blockHeight);
    ctx.strokeStyle = '#dce4ed'; ctx.strokeRect(45, y, width - 90, blockHeight);
    ctx.fillStyle = '#f7fafc'; ctx.fillRect(45, y, width - 90, 42);
    ctx.fillStyle = '#102a43'; ctx.font = 'bold 18px Segoe UI'; ctx.fillText(item.name, 65, y + 27);
    ctx.font = '16px Segoe UI'; ctx.fillStyle = '#486581'; ctx.fillText(`Qty: ${item.qty}`, width - 145, y + 27);
    const columns = [70, 400, 770, 1040, 1260];
    ctx.fillStyle = '#627d98'; ctx.font = 'bold 13px Segoe UI'; ['RANK / BIDDER','MODEL','UNIT PRICE','TOTAL PRICE','ABANS GAP'].forEach((text, i) => ctx.fillText(text, columns[i], y + 75));
    item.quotes.forEach((quote, rank) => {
      const rowY = y + 126 + rank * rowHeight;
      if (rank === 0) { ctx.fillStyle = '#eaf8ef'; ctx.fillRect(46, rowY - 32, width - 92, rowHeight); }
      ctx.fillStyle = rank === 0 ? '#16794f' : '#243b53'; ctx.font = 'bold 15px Segoe UI'; ctx.fillText(`L${rank + 1}  ${quote.name}`, columns[0], rowY);
      ctx.font = '15px Segoe UI'; ctx.fillText(quote.model, columns[1], rowY);
      ctx.fillText(fmt.format(quote.unit), columns[2], rowY); ctx.fillText(fmt.format(quote.total), columns[3], rowY);
      const gap = quote.isAbans ? quote.unit - item.quotes[0].unit : null;
      ctx.fillStyle = gap > 0 ? '#c05621' : '#16794f'; ctx.fillText(gap === null ? '-' : gap === 0 ? 'Lowest bid' : `${fmt.format(gap)} above`, columns[4], rowY);
    });
    y += blockHeight + 22;
  });
  const link = document.createElement('a'); link.download = `Tender-Result-${new Date().toISOString().slice(0, 10)}.png`; link.href = canvas.toDataURL('image/png'); link.click();
}

// PNG export for tender reading: specifications are shown per item; Abans quote model is intentionally omitted.
function generateImage() {
  const resultCards = [...items.children].map((card, index) => {
    const qty = itemQty(card), quotes = [];
    const abansUnit = num(card.querySelector('.abans-unit').value);
    if (abansUnit) quotes.push({ name: 'Abans Computer', unit: abansUnit, total: num(card.querySelector('.abans-total').value), isAbans: true });
    card.querySelectorAll('.bidder-row').forEach(row => {
      const unit = num(row.querySelector('.bidder-unit').value);
      if (unit) quotes.push({ name: row.querySelector('.bidder-name').value || 'Unnamed Bidder', unit, total: num(row.querySelector('.bidder-total').value) });
    });
    quotes.sort((a, b) => a.unit - b.unit);
    return {
      name: card.querySelector('.item-name').value || `Item ${index + 1}`,
      qty, quotes,
      specs: [
        `Category: ${card.querySelector('.category').value || '-'}`,
        `Processor: ${card.querySelector('.processor').value || '-'}`,
        `RAM: ${card.querySelector('.ram').value || '-'}`,
        `Storage: ${card.querySelector('.storage').value || '-'}`,
        `Display / Monitor: ${card.querySelector('.display').value || '-'}`,
        `Warranty: ${card.querySelector('.warranty').value || '-'}`,
        `Local Purchase 1: ${card.querySelector('.local-purchase-1').value || '-'}`,
        `Local Purchase 2: ${card.querySelector('.local-purchase-2').value || '-'}`,
        `Local Purchase 3: ${card.querySelector('.local-purchase-3').value || '-'}`
      ]
    };
  }).filter(item => item.quotes.length);
  if (!resultCards.length) return alert('Enter at least one bidder unit price before generating the image.');
  const width = 1500, rowHeight = 46;
  const height = 155 + resultCards.reduce((sum, item) => sum + 175 + item.quotes.length * rowHeight, 0);
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
  ctx.fillStyle = '#f8f7f9'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#7b1d83'; ctx.fillRect(0, 0, width, 100);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Segoe UI'; ctx.fillText('COMPUTER CORPORATE SALES DIVISION - ABANS PLC  |  TENDER READING RESULT', 50, 42);
  ctx.font = '16px Segoe UI'; ctx.fillText(`Customer: ${document.querySelector('#customerName').value || '-'}     Account Holder: ${document.querySelector('#accountHolderName').value || '-'}     Closing Date: ${document.querySelector('#closingDate').value || '-'}`, 50, 72);
  let y = 125;
  resultCards.forEach(item => {
    const blockHeight = 175 + item.quotes.length * rowHeight;
    ctx.fillStyle = '#fff'; ctx.fillRect(45, y, width - 90, blockHeight); ctx.strokeStyle = '#e8e2e9'; ctx.strokeRect(45, y, width - 90, blockHeight);
    ctx.fillStyle = '#f5eafa'; ctx.fillRect(45, y, width - 90, 42);
    ctx.fillStyle = '#65146d'; ctx.font = 'bold 18px Segoe UI'; ctx.fillText(item.name, 65, y + 28);
    ctx.font = '15px Segoe UI'; ctx.fillText(`Qty: ${item.qty}`, width - 140, y + 28);
    ctx.fillStyle = '#514957'; ctx.font = '13px Segoe UI';
    ctx.fillText(item.specs.slice(0, 2).join('     |     '), 65, y + 67);
    ctx.fillText(item.specs.slice(2, 4).join('     |     '), 65, y + 88);
    ctx.fillText(item.specs.slice(4).join('     |     '), 65, y + 109);
    const headerY = y + 138, columns = [70, 340, 800, 1055, 1240];
    ctx.fillStyle = '#f7f4f8'; ctx.fillRect(46, headerY - 20, width - 92, 28);
    ctx.fillStyle = '#766d78'; ctx.font = 'bold 12px Segoe UI'; ['RANK', 'BIDDER', 'UNIT PRICE', 'TOTAL PRICE', 'ABANS GAP'].forEach((text, i) => ctx.fillText(text, columns[i], headerY));
    item.quotes.forEach((quote, rank) => {
      const rowY = headerY + 28 + rank * rowHeight;
      if (rank === 0) { ctx.fillStyle = '#e9f8ef'; ctx.fillRect(46, rowY - 25, width - 92, rowHeight); }
      const gap = quote.isAbans ? quote.unit - item.quotes[0].unit : null;
      ctx.fillStyle = rank === 0 ? '#168453' : '#29242b'; ctx.font = 'bold 15px Segoe UI';
      ctx.fillText(`L${rank + 1}`, columns[0], rowY); ctx.fillText(quote.name, columns[1], rowY); ctx.fillText(fmt.format(quote.unit), columns[2], rowY); ctx.fillText(fmt.format(quote.total), columns[3], rowY);
      ctx.fillStyle = gap > 0 ? '#c05621' : '#168453'; ctx.fillText(gap === null ? '-' : gap === 0 ? 'Lowest bid' : `${fmt.format(gap)} (+${(gap / item.quotes[0].unit * 100).toFixed(1)}%)`, columns[4], rowY);
    });
    y += blockHeight + 20;
  });
  const link = document.createElement('a'); link.download = `Tender-Result-${new Date().toISOString().slice(0, 10)}.png`; link.href = canvas.toDataURL('image/png'); link.click();
}

document.querySelector('#addItem').onclick = addItem;
document.querySelector('#generateImage').onclick = generateImage;
document.querySelector('#newEntry').onclick = () => { if (!confirm('Clear this form and start a new tender entry?')) return; cloudTenderId = ''; cloudCreatedAt = ''; offlineTenderId = ''; localStorage.removeItem('abansCloudTenderId'); localStorage.removeItem('abansCloudCreatedAt'); localStorage.removeItem('abansOfflineTenderId'); localStorage.removeItem(storageKey); document.querySelector('#customerName').value = ''; document.querySelector('#accountHolderName').value = ''; document.querySelector('#closingDate').value = ''; items.innerHTML = ''; addItem(); setCloudStatus('New empty tender entry created.'); };


document.querySelector('#saveDraft').onclick = () => saveCloud('draft');
document.querySelector('#saveFinal').onclick = () => saveCloud('final');
document.querySelector('#customerName').addEventListener('input', saveData);
document.querySelector('#accountHolderName').addEventListener('input', saveData);
document.querySelector('#closingDate').addEventListener('change', saveData);
loadAccountHolders();
if (!restoreData()) addItem();
const pendingCloudTenderId = localStorage.getItem('abansOpenCloudTenderId');
if (pendingCloudTenderId) { localStorage.removeItem('abansOpenCloudTenderId'); openCloudTender(pendingCloudTenderId); }

// Remember text entered once and offer it as a suggestion on future tender entries.
const suggestionStorageKey = 'abansTenderTextSuggestions';
let textSuggestions = {};
try { textSuggestions = JSON.parse(localStorage.getItem(suggestionStorageKey) || '{}'); } catch { textSuggestions = {}; }

function suggestionField(input) {
  if (input.id === 'customerName') return 'Customer names';
  if (input.id === 'accountHolderName') return 'Account holders';
  const classes = input.classList;
  if (classes.contains('item-name')) return 'Item names';
  if (classes.contains('bidder-name')) return 'Bidder names';
  if (classes.contains('bidder-model')) return 'Bidder models';
  if (classes.contains('model')) return 'Abans models';
  if (classes.contains('processor')) return 'Processors';
  if (classes.contains('ram')) return 'RAM';
  if (classes.contains('storage')) return 'Storage';
  if (classes.contains('display')) return 'Display / Monitor';
  if (classes.contains('warranty')) return 'Warranty';
  return '';
}

function suggestionListId(key) { return `suggestions-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
function prepareSuggestions(input) {
  const key = suggestionField(input); if (!key) return;
  const listId = input.id === 'accountHolderName' ? 'accountHolders' : suggestionListId(key);
  let list = document.querySelector(`#${listId}`);
  if (!list) { list = document.createElement('datalist'); list.id = listId; document.body.append(list); }
  const existing = [...list.options].map(option => option.value);
  const values = [...new Set([...existing, ...(textSuggestions[key] || [])])].slice(0, 40);
  list.innerHTML = values.map(value => `<option value="${value.replaceAll('&','&amp;').replaceAll('"','&quot;')}"></option>`).join('');
  input.setAttribute('list', listId);
}

function rememberSuggestion(input) {
  const key = suggestionField(input), value = input.value.trim();
  if (!key || !value) return;
  const values = textSuggestions[key] || [];
  textSuggestions[key] = [value, ...values.filter(item => item.toLowerCase() !== value.toLowerCase())].slice(0, 40);
  localStorage.setItem(suggestionStorageKey, JSON.stringify(textSuggestions));
  prepareSuggestions(input);
}

document.addEventListener('focusin', event => { if (event.target instanceof HTMLInputElement) prepareSuggestions(event.target); });
document.addEventListener('focusout', event => { if (event.target instanceof HTMLInputElement) rememberSuggestion(event.target); });
document.querySelectorAll('input').forEach(prepareSuggestions);
