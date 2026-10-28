const money = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAGE_SIZE = 50;
let currentPage = 1;
const firebaseUrl = 'https://tender-reading-management-default-rtdb.firebaseio.com';
const number = value => Number(value) || 0;
let records = [];

function cardAnalysis(card) {
  const quotes = [];
  if (number(card.abansUnit)) quotes.push({ name: 'Abans Computer', model: card.model || '-', unit: number(card.abansUnit), total: number(card.abansTotal), isAbans: true });
  (card.bidders || []).forEach(bidder => { if (number(bidder.unit)) quotes.push({ name: bidder.name || 'Unnamed bidder', model: bidder.model || '-', unit: number(bidder.unit), total: number(bidder.total) }); });
  quotes.sort((a,b) => a.unit - b.unit);
  const abans = quotes.find(quote => quote.isAbans);
  const gap = abans && quotes[0] ? abans.unit - quotes[0].unit : null;
  return { quotes, winner: quotes[0], gap, gapPct: gap !== null && quotes[0] && quotes[0].unit ? gap / quotes[0].unit * 100 : null };
}

function tenderAnalysis(record) {
  const items = (record.cards || []).map(card => ({ card, analysis: cardAnalysis(card) }));
  const winners = {}; items.forEach(item => { if (item.analysis.winner) winners[item.analysis.winner.name] = (winners[item.analysis.winner.name] || 0) + 1; });
  const winner = Object.entries(winners).sort((a,b) => b[1]-a[1])[0];
  const gaps = items.map(item => item.analysis.gap).filter(gap => gap !== null);
  const gapPcts = items.map(item => item.analysis.gapPct).filter(gap => gap !== null);
  return { items, winner: winner ? `${winner[0]} (${winner[1]} L1)` : '-', gap: gaps.length ? gaps.reduce((a,b)=>a+b,0)/gaps.length : null, gapPct: gapPcts.length ? gapPcts.reduce((a,b)=>a+b,0)/gapPcts.length : null };
}

function normalizeSearch(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function buildFilters() {
  [['category','category','All categories'],['model','model','All quoted models'],['processor','processor','All processors'],['ram','ram','All RAM'],['storage','storage','All storage'],['display','display','All displays / monitors'],['warranty','warranty','All warranties']].forEach(([id,field,label]) => {
    const select=document.querySelector(`#${id}`), current=select.value;
    const rawValues=records.flatMap(record=>(record.cards||[]).map(card=>card[field]|| (field==='display'?card.monitor:'')).filter(Boolean)).filter(value=>field!=='category'||!/^local\s*purchase(?:\s*[123])?$/i.test(String(value).trim())).sort((a,b)=>String(a).localeCompare(String(b)));
    const values=[...new Map(rawValues.map(value=>[normalizeSearch(value),value])).values()];
    select.innerHTML=`<option value="all">${label}</option>${values.map(value=>`<option value="${value}">${value}</option>`).join('')}`;
    select.value=values.find(value=>normalizeSearch(value)===normalizeSearch(current))||'all';
  });
}

function filteredRecords() {
  const term=normalizeSearch(document.querySelector('#search').value), category=document.querySelector('#category').value, model=document.querySelector('#model').value, processor=document.querySelector('#processor').value, ram=document.querySelector('#ram').value, storage=document.querySelector('#storage').value, display=document.querySelector('#display').value, warranty=document.querySelector('#warranty').value, from=document.querySelector('#from').value, to=document.querySelector('#to').value, sort=document.querySelector('#sort').value;
  const shown=records.filter(record=>{const cards=record.cards||[];const text=normalizeSearch(`${record.customerName||''} ${record.accountHolderName||''} ${cards.map(card=>card.searchTextNormalized||[card.name,card.category,card.model,card.processor,card.ram,card.storage,card.display,card.warranty,card.localPurchase1,card.localPurchase2,card.localPurchase3,...(card.bidders||[]).flatMap(bidder=>[bidder.name,bidder.model])].join(' ')).join(' ')}`); const matched=cards.some(card=>(category==='all'||normalizeSearch(card.category)===normalizeSearch(category))&&(model==='all'||normalizeSearch(card.model)===normalizeSearch(model))&&(processor==='all'||(card.processorNormalized||normalizeSearch(card.processor))===normalizeSearch(processor))&&(ram==='all'||(card.ramNormalized||normalizeSearch(card.ram))===normalizeSearch(ram))&&(storage==='all'||normalizeSearch(card.storage)===normalizeSearch(storage))&&(display==='all'||normalizeSearch(card.display||card.monitor)===normalizeSearch(display))&&(warranty==='all'||normalizeSearch(card.warranty)===normalizeSearch(warranty))); const date=record.closingDate||'';return (!term||text.includes(term))&&(!from||date>=from)&&(!to||date<=to)&&matched;});
  return shown.sort((a,b)=>sort==='customer'?String(a.customerName||'').localeCompare(String(b.customerName||'')):sort==='closing'?String(a.closingDate||'').localeCompare(String(b.closingDate||'')):sort==='items'?(b.cards||[]).length-(a.cards||[]).length:String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}

function details(record) {
  return `<tr class="detail-row"><td colspan="8"><div class="tender-details">${tenderAnalysis(record).items.map(({card,analysis})=>`<section class="item-detail"><h3>${card.name||'Item'} <span>Qty: ${card.qty||'-'}</span></h3><div class="record-specifications"><h4>Specifications</h4><div class="record-spec-grid"><div><strong>Category</strong><span>${card.category||'-'}</span></div><div><strong>Quoted Model</strong><span>${card.model||'-'}</span></div><div><strong>Processor</strong><span>${card.processor||'-'}</span></div><div><strong>RAM</strong><span>${card.ram||'-'}</span></div><div><strong>Storage</strong><span>${card.storage||'-'}</span></div><div><strong>Display / Monitor</strong><span>${card.display||card.monitor||'-'}</span></div><div><strong>Warranty</strong><span>${card.warranty||'-'}</span></div></div></div><table><thead><tr><th>Rank</th><th>Bidder</th><th>Model</th><th>Unit Price</th><th>Total Price</th></tr></thead><tbody>${analysis.quotes.map((quote,index)=>`<tr class="${index===0?'winner':''}"><td>L${index+1}</td><td>${quote.name}</td><td>${quote.model}</td><td>${money.format(quote.unit)}</td><td>${money.format(quote.total)}</td></tr>`).join('')}</tbody></table></section>`).join('')}</div></td></tr>`;
}

function editTender(record) { localStorage.setItem('abansTenderDraft', JSON.stringify({ ...record, cloudTenderId: record.id, expiresAt: Date.now() + 2 * 60 * 60 * 1000 })); localStorage.setItem('abansCloudTenderId', record.id); location.href = 'index.html'; }
async function deleteTender(record) { if (!confirm(`Delete tender for ${record.customerName || 'this customer'}? This cannot be undone.`)) return; try { const response = await fetch(`https://tender-reading-management-default-rtdb.firebaseio.com/tenders/${record.id}.json`, { method: 'DELETE' }); if (!response.ok) throw new Error(); records = records.filter(item => item.id !== record.id); draw(); alert('Tender deleted from Firebase.'); } catch { alert('Could not delete from Firebase. Check your database connection and rules.'); } }
async function generateImage(record) {
  const W = 1400, margin = 54, contentW = W - margin * 2;
  const scale = 1;
  const canvasMeasure = document.createElement('canvas').getContext('2d');
  const wrap = (value, font, maxWidth) => {
    canvasMeasure.font = font;
    const words = String(value == null || value === '' ? '-' : value).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const next = line ? line + ' ' + word : word;
      if (line && canvasMeasure.measureText(next).width > maxWidth) { lines.push(line); line = word; }
      else line = next;
    });
    if (line) lines.push(line);
    return lines.length ? lines : ['-'];
  };
  const fontTitle = 'bold 42px Arial';
  const fontHead = 'bold 29px Arial';
  const fontBody = '25px Arial';
  const fontSmall = '22px Arial';
  const rowPad = 18;
  const prepared = [];
  let totalHeight = 180 + 30;
  const items = tenderAnalysis(record).items;
  items.forEach((item, itemIndex) => {
    const card = item.card;
    const fields = [
      ['Quantity', card.qty], ['Category', card.category], ['Quoted model', card.model],
      ['Processor', card.processor], ['RAM', card.ram], ['Storage', card.storage],
      ['Display / monitor', card.display || card.monitor], ['Warranty', card.warranty],
      ['Local purchase 1', card.localPurchase1], ['Local purchase 2', card.localPurchase2],
      ['Local purchase 3', card.localPurchase3]
    ].filter(pair => pair[1] !== undefined && pair[1] !== null && String(pair[1]).trim() !== '');
    const specColW = Math.floor(contentW / 2);
    const specs = fields.map(pair => ({label:pair[0], lines:wrap(pair[1], fontBody, specColW - 270)}));
    const quotes = (item.analysis.quotes || []).map((quote, index) => ({
      quote, rank:index + 1,
      name:wrap(quote.name || 'Unnamed bidder', fontBody, 272),
      model:wrap(quote.model || '-', fontSmall, 272)
    }));
    let specRowsHeight = 0;
    for (let i = 0; i < specs.length; i += 2) specRowsHeight += Math.max(...specs.slice(i, i + 2).map(row => Math.max(34, row.lines.length * 32 + 10)));
    const specHeight = 64 + specRowsHeight;
    const quoteHeight = 68 + quotes.reduce((sum, row) => sum + Math.max(76, Math.max(row.name.length, row.model.length) * 34 + rowPad), 0);
    const height = 72 + specHeight + 24 + quoteHeight + 36;
    prepared.push({card, itemIndex, specs, quotes, height, specHeight, quoteHeight});
    totalHeight += height + 22;
  });
  totalHeight = Math.max(600, totalHeight);
  if (totalHeight > 30000) {
    alert('This tender has too much content for one image. Please reduce the number of bidders before exporting.');
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#f3f5f9'; ctx.fillRect(0, 0, W, totalHeight);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 125);
  ctx.fillStyle = '#7b1d83'; ctx.fillRect(0, 0, 10, 125);
  ctx.fillStyle = '#29242b'; ctx.font = 'bold 25px Arial';
  ctx.fillText('TENDER RESULT - ' + String(record.customerName || 'Customer') + ' | Account holder: ' + String(record.accountHolderName || '-'), margin, 55);
  ctx.fillStyle = '#625a66'; ctx.font = fontSmall;
  ctx.fillText('Closing date: ' + String(record.closingDate || '-'), margin, 95);
  let y = 145;
  prepared.forEach(section => {
    const card = section.card;
    ctx.fillStyle = '#eee7f2'; ctx.fillRect(margin, y, contentW, 76);
    ctx.fillStyle = '#65146d'; ctx.font = fontHead;
    ctx.fillText('ITEM ' + (section.itemIndex + 1) + ': ' + wrap(card.name || 'Item', fontHead, contentW - 40)[0], margin + 18, y + 31);
    ctx.fillStyle = '#29242b'; ctx.font = fontBody;
    ctx.fillText('Quantity: ' + String(card.qty || '-'), margin + 18, y + 61);
    y += 94;
    ctx.fillStyle = '#fff'; ctx.fillRect(margin, y, contentW, section.specHeight);
    ctx.strokeStyle = '#dce2e9'; ctx.strokeRect(margin, y, contentW, section.specHeight);
    ctx.fillStyle = '#29242b'; ctx.font = fontHead; ctx.fillText('SPECIFICATIONS', margin + 18, y + 34);
    const specColW = Math.floor(contentW / 2);
    ctx.strokeStyle = '#e8edf3'; ctx.beginPath(); ctx.moveTo(margin + specColW, y + 52); ctx.lineTo(margin + specColW, y + section.specHeight - 10); ctx.stroke();
    let sy = y + 64;
    for (let i = 0; i < section.specs.length; i += 2) {
      const pair = section.specs.slice(i, i + 2);
      const rowH = Math.max(...pair.map(row => Math.max(34, row.lines.length * 32 + 10)));
      pair.forEach((row, j) => {
        const cellX = margin + j * specColW;
        ctx.fillStyle = '#625a66'; ctx.font = 'bold ' + fontSmall;
        ctx.fillText(row.label, cellX + 18, sy);
        ctx.fillStyle = '#29242b'; ctx.font = fontBody;
        row.lines.forEach((line, li) => ctx.fillText(line, cellX + 252, sy + li * 32));
      });
      sy += rowH;
      if (i + 2 < section.specs.length) { ctx.strokeStyle = '#eef1f5'; ctx.beginPath(); ctx.moveTo(margin + 14, sy - 6); ctx.lineTo(margin + contentW - 14, sy - 6); ctx.stroke(); }
    }
    y += section.specHeight + 24;
    const tableX = margin, tableW = contentW;
    const cols = [96, 300, 300, 264, tableW - 960];
    const colX = [tableX]; cols.forEach(w => colX.push(colX[colX.length - 1] + w));
    ctx.fillStyle = '#65146d'; ctx.fillRect(tableX, y, tableW, 68);
    ctx.strokeStyle = '#ffffff55'; ctx.beginPath();
    for (let i = 1; i < cols.length; i++) { ctx.moveTo(colX[i], y + 10); ctx.lineTo(colX[i], y + 58); }
    ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'left';
    ctx.fillText('RANK', colX[0] + 16, y + 43);
    ctx.fillText('BIDDER', colX[1] + 14, y + 43);
    ctx.fillText('MODEL', colX[2] + 14, y + 43);
    ctx.textAlign = 'right';
    ctx.fillText('UNIT PRICE', colX[4] - 16, y + 43);
    ctx.fillText('TOTAL PRICE', colX[5] - 16, y + 43);
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#dfe5ec'; ctx.beginPath();
    for (let i = 1; i < cols.length; i++) { ctx.moveTo(colX[i], y + 68); ctx.lineTo(colX[i], y + section.quoteHeight); }
    ctx.stroke();
    y += 68;
    section.quotes.forEach((row, index) => {
      const lines = Math.max(row.name.length, row.model.length, 1);
      const rh = Math.max(76, lines * 34 + rowPad);
      ctx.fillStyle = row.rank === 1 ? '#e4f5eb' : (index % 2 ? '#fff' : '#f9fafc');
      ctx.fillRect(tableX, y, tableW, rh);
      ctx.strokeStyle = '#dce2e9'; ctx.strokeRect(tableX, y, tableW, rh);
      ctx.fillStyle = row.rank === 1 ? '#126b42' : '#29242b';
      ctx.font = 'bold ' + fontBody; ctx.fillText('L' + row.rank, colX[0] + 16, y + rh / 2 + 7);
      ctx.fillStyle = '#29242b'; ctx.font = fontBody;
      row.name.forEach((line, i) => ctx.fillText(line, colX[1] + 14, y + 32 + i * 34));
      ctx.font = fontSmall;
      row.model.forEach((line, i) => ctx.fillText(line, colX[2] + 14, y + 26 + i * 27));
      ctx.font = fontBody; ctx.textAlign = 'right';
      ctx.fillText(money.format(row.quote.unit), colX[4] - 16, y + rh / 2 + 6);
      ctx.fillText(money.format(row.quote.total), colX[5] - 16, y + rh / 2 + 6);
      ctx.textAlign = 'left';
      y += rh;
    });
    y += 36;
  });
  ctx.fillStyle = '#746b76'; ctx.font = '20px Arial';
  ctx.fillText('Abans Computer | Tender price comparison', margin, totalHeight - 18);
  const link = document.createElement('a');
  link.download = 'Tender-' + String(record.customerName || 'Result').replace(/[^a-z0-9]+/gi, '-') + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
function renderVisualAnalytics(shown) {
  let host = document.querySelector('#visualAnalytics');
  if (!host) { host = document.createElement('section'); host.id = 'visualAnalytics'; host.className = 'visual-analytics'; document.querySelector('#categoryChart').insertAdjacentElement('afterend', host); }
  const analyses = shown.map(record => ({ record, analysis: tenderAnalysis(record) }));
  const items = analyses.flatMap(({ analysis }) => analysis.items);
  const totalItems = items.length;
  const abansWins = items.filter(item => item.analysis.winner?.name === 'Abans Computer').length;
  const winRate = totalItems ? Math.round(abansWins / totalItems * 100) : 0;
  const bidders = {};
  items.forEach(item => { const name = item.analysis.winner?.name; if (name) bidders[name] = (bidders[name] || 0) + 1; });
  const bidderRows = Object.entries(bidders).sort((a,b) => b[1] - a[1]).slice(0,5);
  const bidderMax = Math.max(...bidderRows.map(([,count]) => count), 1);
  const gaps = analyses.map(({record,analysis}) => ({ name: record.customerName || 'Tender', gap: analysis.gap || 0 })).filter(item => item.gap >= 0).sort((a,b) => b.gap-a.gap).slice(0,5);
  const gapMax = Math.max(...gaps.map(item => item.gap), 1);
  const points = gaps.length > 1 ? gaps.map((item,index) => `${10 + index/(gaps.length-1)*260},${116 - item.gap/gapMax*85}`).join(' ') : '10,116 270,116';
  host.innerHTML = `<article class="visual-card win-card"><div class="visual-card-head"><div><p class="eyebrow">Win position</p><h3>Abans L1 rate</h3></div><span class="insight-pill">Live</span></div><div class="ring-layout"><div class="progress-ring" style="--progress:${winRate}%"><span>${winRate}%</span></div><div><strong>${abansWins} of ${totalItems}</strong><p>items where Abans has the lowest unit price.</p></div></div></article><article class="visual-card"><div class="visual-card-head"><div><p class="eyebrow">Market leaders</p><h3>L1 bidder leaderboard</h3></div><span class="chart-caption">Top 5</span></div><div class="leader-bars">${bidderRows.map(([name,count]) => `<div><span title="${name}">${name}</span><i><b style="width:${count/bidderMax*100}%"></b></i><strong>${count}</strong></div>`).join('') || '<p class="chart-empty">No bidder pricing available.</p>'}</div></article><article class="visual-card"><div class="visual-card-head"><div><p class="eyebrow">Price movement</p><h3>Abans gap by tender</h3></div><span class="chart-caption">Unit price</span></div><div class="line-chart"><svg viewBox="0 0 280 135" role="img" aria-label="Abans price gap chart"><defs><linearGradient id="gapFill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#7b1d83" stop-opacity=".28"/><stop offset="1" stop-color="#7b1d83" stop-opacity="0"/></linearGradient></defs><path d="M10 116 L${points.replaceAll(' ', ' L')} L270 116 Z" fill="url(#gapFill)"/><polyline points="${points}" fill="none" stroke="#7b1d83" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="gap-labels">${gaps.map(item => `<span title="${item.name}">${item.name}</span>`).join('') || '<span>No price-gap data.</span>'}</div></div></article>`;
}

function draw() {
  const shown=filteredRecords(), analyses=shown.map(tenderAnalysis), totalItems=shown.reduce((sum,record)=>sum+(record.cards||[]).length,0), l1=analyses.reduce((sum,analysis)=>sum+analysis.items.filter(item=>item.analysis.winner?.name==='Abans Computer').length,0), comparisons=analyses.reduce((sum,analysis)=>sum+analysis.items.length,0), gaps=analyses.map(analysis=>analysis.gap).filter(gap=>gap!==null), averageGap=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null, gapPcts=analyses.map(analysis=>analysis.gapPct).filter(gap=>gap!==null), averageGapPct=gapPcts.length?gapPcts.reduce((a,b)=>a+b,0)/gapPcts.length:null;
  document.querySelector('#kpis').innerHTML=`<div><strong>${shown.length}</strong><span>Tenders shown</span></div><div><strong>${totalItems}</strong><span>Tender items</span></div><div><strong>${l1} / ${comparisons}</strong><span>Abans L1 results</span></div><div><strong>${averageGap===null?'-':money.format(averageGap)+' ('+averageGapPct.toFixed(1)+'%)'}</strong><span>Avg. Abans unit gap vs L1</span></div>`;
  const categories={};shown.flatMap(record=>record.cards||[]).forEach(card=>{if(card.category)categories[card.category]=(categories[card.category]||0)+1});const max=Math.max(...Object.values(categories),1);document.querySelector('#categoryChart').innerHTML=Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([name,count])=>`<div><span>${name}</span><i><b style="width:${count/max*100}%"></b></i><strong>${count}</strong></div>`).join('')||'No category data.';
  renderVisualAnalytics(shown);
  const totalPages=Math.max(1,Math.ceil(shown.length/PAGE_SIZE)); if(currentPage>totalPages)currentPage=totalPages; if(currentPage<1)currentPage=1;
  const pageStart=(currentPage-1)*PAGE_SIZE, pageRecords=shown.slice(pageStart,pageStart+PAGE_SIZE);
  document.querySelector('#count').textContent=shown.length?`${shown.length} tender record${shown.length===1?'':'s'} - showing ${pageStart+1}-${pageStart+pageRecords.length}`:`0 tender records`;
  const pageInfo=document.querySelector('#pageInfo'); if(pageInfo)pageInfo.textContent=shown.length?`Page ${currentPage} of ${totalPages}`:'';
  const prev=document.querySelector('#pagePrev'), next=document.querySelector('#pageNext'); if(prev)prev.disabled=currentPage<=1; if(next)next.disabled=currentPage>=totalPages;
  const body=document.querySelector('#records');body.innerHTML='';if(!shown.length){body.innerHTML='<tr><td colspan="8" class="table-empty">No tender records match these filters.</td></tr>';return;}pageRecords.forEach(record=>{const analysis=tenderAnalysis(record),row=document.createElement('tr');row.className='record-row';row.innerHTML=`<td><strong>${record.customerName||'-'}</strong></td><td>${record.accountHolderName||'-'}</td><td>${record.closingDate||'-'}</td><td>${(record.cards||[]).length}</td><td>${analysis.winner}</td><td class="${analysis.gap>0?'gap-positive':''}">${analysis.gap===null?'-':money.format(analysis.gap)+(analysis.gapPct===null?'':' ('+analysis.gapPct.toFixed(1)+'%)')}</td><td>${record.updatedAt?new Date(record.updatedAt).toLocaleString():'-'}</td><td class="row-actions"><button class="button small image">IMG</button><button class="button small edit">Edit</button><button class="button small delete">Delete</button></td>`;row.onclick=()=>{const next=row.nextElementSibling;if(next?.classList.contains('detail-row'))next.remove();else row.insertAdjacentHTML('afterend',details(record));};row.querySelector('.image').onclick=async event=>{event.stopPropagation();await generateImage(record);};row.querySelector('.edit').onclick=event=>{event.stopPropagation();editTender(record);};row.querySelector('.delete').onclick=event=>{event.stopPropagation();deleteTender(record);};body.append(row);});
}

function exportBackup() { if(!records.length)return alert('No tender records loaded yet - nothing to back up.'); const backup={exportedAt:new Date().toISOString(),source:'tender-reading-management Firebase',count:records.length,tenders:Object.fromEntries(records.map(record=>{const copy={...record};const id=copy.id;delete copy.id;return [id,copy];}))}; const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));link.download='tender-backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();URL.revokeObjectURL(link.href); }
function exportCsv() { const rows=[['Customer','Account Holder','Closing Date','Item','Category','Bidder','Model','Unit Price','Total Price']];filteredRecords().forEach(record=>(record.cards||[]).forEach(card=>cardAnalysis(card).quotes.forEach(quote=>rows.push([record.customerName||'',record.accountHolderName||'',record.closingDate||'',card.name||'',card.category||'',quote.name,quote.model,quote.unit,quote.total]))));const text=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));link.download='tender-report.csv';link.click();URL.revokeObjectURL(link.href);}

async function load() { try { const source = window.__FIREBASE_TENDERS__ || await fetch(`${firebaseUrl}/tenders.json`).then(response => { if (!response.ok) throw new Error('Firebase unavailable'); return response.json(); }); records=Object.entries(source||{}).map(([id,record])=>({id,...record})).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));buildFilters();draw(); } catch { document.querySelector('#records').innerHTML='<tr><td colspan="8" class="table-empty">Could not load Firebase tender records. Check internet connection and Firebase rules.</td></tr>'; } }
['search','category','model','processor','ram','storage','display','warranty','from','to','sort'].forEach(id=>document.querySelector(`#${id}`).addEventListener(id==='search'?'input':'change',()=>{currentPage=1;draw();}));document.querySelector('#reload').onclick=()=>location.reload();document.querySelector('#clear').onclick=()=>{document.querySelector('#search').value='';['category','model','processor','ram','storage','display','warranty'].forEach(id=>document.querySelector(`#${id}`).value='all');document.querySelector('#from').value='';document.querySelector('#to').value='';document.querySelector('#sort').value='updated';currentPage=1;draw();};document.querySelector('#exportCsv').onclick=exportCsv;const backupButton=document.querySelector('#exportBackup');if(backupButton)backupButton.onclick=exportBackup;const prevButton=document.querySelector('#pagePrev');if(prevButton)prevButton.onclick=()=>{if(currentPage>1){currentPage--;draw();}};const nextButton=document.querySelector('#pageNext');if(nextButton)nextButton.onclick=()=>{currentPage++;draw();};load();
