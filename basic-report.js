const money = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 });
const firebaseUrl = 'https://tender-reading-management-default-rtdb.firebaseio.com';
const number = value => Number(value) || 0;
let records = [];

function cardAnalysis(card) {
  const quotes = [];
  if (number(card.abansUnit)) quotes.push({ name: 'Abans Computer', model: card.model || '-', unit: number(card.abansUnit), total: number(card.abansTotal), isAbans: true });
  (card.bidders || []).forEach(bidder => { if (number(bidder.unit)) quotes.push({ name: bidder.name || 'Unnamed bidder', model: bidder.model || '-', unit: number(bidder.unit), total: number(bidder.total) }); });
  quotes.sort((a,b) => a.unit - b.unit);
  const abans = quotes.find(quote => quote.isAbans);
  return { quotes, winner: quotes[0], gap: abans && quotes[0] ? abans.unit - quotes[0].unit : null };
}

function tenderAnalysis(record) {
  const items = (record.cards || []).map(card => ({ card, analysis: cardAnalysis(card) }));
  const winners = {}; items.forEach(item => { if (item.analysis.winner) winners[item.analysis.winner.name] = (winners[item.analysis.winner.name] || 0) + 1; });
  const winner = Object.entries(winners).sort((a,b) => b[1]-a[1])[0];
  const gaps = items.map(item => item.analysis.gap).filter(gap => gap !== null);
  return { items, winner: winner ? `${winner[0]} (${winner[1]} L1)` : '-', gap: gaps.length ? gaps.reduce((a,b)=>a+b,0)/gaps.length : null };
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
function generateImage(record) { const analysis=tenderAnalysis(record), width=1500, line=42, height=180+analysis.items.reduce((sum,item)=>sum+105+item.analysis.quotes.length*line,0), canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#f5f8fc';ctx.fillRect(0,0,width,height);ctx.fillStyle='#102a43';ctx.font='bold 26px Segoe UI';ctx.fillText(record.customerName||'Tender Result',45,48);ctx.font='17px Segoe UI';ctx.fillStyle='#486581';ctx.fillText(`Account Holder: ${record.accountHolderName||'-'}     Closing Date: ${record.closingDate||'-'}`,45,80);let y=112;analysis.items.forEach(({card,analysis})=>{const block=105+analysis.quotes.length*line;ctx.fillStyle='#fff';ctx.fillRect(35,y,width-70,block);ctx.strokeStyle='#dce4ed';ctx.strokeRect(35,y,width-70,block);ctx.fillStyle='#eef4f8';ctx.fillRect(35,y,width-70,38);ctx.fillStyle='#102a43';ctx.font='bold 17px Segoe UI';ctx.fillText(`${card.name||'Item'}  |  Qty: ${card.qty||'-'}`,55,y+25);ctx.fillStyle='#627d98';ctx.font='bold 12px Segoe UI';['RANK','BIDDER','MODEL','UNIT PRICE','TOTAL PRICE'].forEach((text,index)=>ctx.fillText(text,[55,220,590,1000,1240][index],y+63));analysis.quotes.forEach((quote,index)=>{const row=y+91+index*line;if(index===0){ctx.fillStyle='#eaf8ef';ctx.fillRect(36,row-25,width-72,line)}ctx.fillStyle=index===0?'#16794f':'#243b53';ctx.font='15px Segoe UI';ctx.fillText(`L${index+1}`,[55][0],row);ctx.fillText(quote.name,220,row);ctx.fillText(quote.model,590,row);ctx.fillText(money.format(quote.unit),1000,row);ctx.fillText(money.format(quote.total),1240,row);});y+=block+15;});const link=document.createElement('a');link.download=`Tender-${(record.customerName||'Result').replaceAll(' ','-')}.png`;link.href=canvas.toDataURL('image/png');link.click();}

// Detailed image export: includes every item's complete tender specification.
function generateImage(record) {
  const analysis = tenderAnalysis(record), width = 1600, quoteLine = 38;
  const blockHeights = analysis.items.map(item => 180 + item.analysis.quotes.length * quoteLine);
  const height = 175 + blockHeights.reduce((sum, block) => sum + block + 18, 0);
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
  ctx.fillStyle = '#f7f8fa'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, 112);
  ctx.fillStyle = '#7b1d83'; ctx.fillRect(0, 0, 8, 112);
  ctx.fillStyle = '#29242b'; ctx.font = 'bold 26px Segoe UI'; ctx.fillText('Tender Price Comparison', 42, 42);
  ctx.fillStyle = '#7b1d83'; ctx.font = 'bold 19px Segoe UI'; ctx.fillText(record.customerName || 'Tender Record', 42, 72);
  ctx.fillStyle = '#766d78'; ctx.font = '14px Segoe UI';
  ctx.fillText(`Account Holder: ${record.accountHolderName || '-'}     |     Closing Date: ${record.closingDate || '-'}`, 42, 96);
  let y = 132;
  analysis.items.forEach(({ card, analysis: itemAnalysis }, itemIndex) => {
    const block = blockHeights[itemIndex];
    ctx.fillStyle = '#fff'; ctx.fillRect(35, y, width - 70, block);
    ctx.strokeStyle = '#e3e5e8'; ctx.strokeRect(35, y, width - 70, block);
    ctx.fillStyle = '#f4edf6'; ctx.fillRect(35, y, width - 70, 38);
    ctx.fillStyle = '#65146d'; ctx.font = 'bold 18px Segoe UI';
    ctx.fillText(`${card.name || `Item ${itemIndex + 1}`}  |  Qty: ${card.qty || '-'}`, 55, y + 26);
    const specs = [
      `Category: ${card.category || '-'}`, `Model: ${card.model || '-'}`,
      `Processor: ${card.processor || '-'}`, `RAM: ${card.ram || '-'}`,
      `Storage: ${card.storage || '-'}`, `Display / Monitor: ${card.display || card.monitor || '-'}`,
      `Warranty: ${card.warranty || '-'}`
    ];
    ctx.fillStyle = '#514957'; ctx.font = '13px Segoe UI';
    ctx.fillText(specs.slice(0, 2).join('     |     '), 55, y + 63);
    ctx.fillText(specs.slice(2, 5).join('     |     '), 55, y + 84);
    ctx.fillText(specs.slice(5).join('     |     '), 55, y + 105);
    const headerY = y + 130;
    ctx.fillStyle = '#f7f4f8'; ctx.fillRect(36, headerY - 19, width - 72, 27);
    ctx.fillStyle = '#766d78'; ctx.font = 'bold 11px Segoe UI';
    ['RANK', 'BIDDER', 'MODEL', 'UNIT PRICE', 'TOTAL PRICE'].forEach((text, index) => ctx.fillText(text, [55, 220, 600, 1080, 1330][index], headerY));
    itemAnalysis.quotes.forEach((quote, index) => {
      const rowY = headerY + 27 + index * quoteLine;
      if (index === 0) { ctx.fillStyle = '#e9f8ef'; ctx.fillRect(36, rowY - 20, width - 72, quoteLine); }
      ctx.fillStyle = index === 0 ? '#168453' : '#29242b'; ctx.font = '14px Segoe UI';
      ctx.fillText(`L${index + 1}`, 55, rowY); ctx.fillText(quote.name, 220, rowY); ctx.fillText(quote.model, 600, rowY);
      ctx.fillText(money.format(quote.unit), 1080, rowY); ctx.fillText(money.format(quote.total), 1330, rowY);
    });
    y += block + 18;
  });
  const link = document.createElement('a'); link.download = `Tender-${(record.customerName || 'Result').replaceAll(' ', '-')}.png`; link.href = canvas.toDataURL('image/png'); link.click();
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
  const shown=filteredRecords(), analyses=shown.map(tenderAnalysis), totalItems=shown.reduce((sum,record)=>sum+(record.cards||[]).length,0), l1=analyses.reduce((sum,analysis)=>sum+analysis.items.filter(item=>item.analysis.winner?.name==='Abans Computer').length,0), comparisons=analyses.reduce((sum,analysis)=>sum+analysis.items.length,0), gaps=analyses.map(analysis=>analysis.gap).filter(gap=>gap!==null), averageGap=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null;
  document.querySelector('#kpis').innerHTML=`<div><strong>${shown.length}</strong><span>Tenders shown</span></div><div><strong>${totalItems}</strong><span>Tender items</span></div><div><strong>${l1} / ${comparisons}</strong><span>Abans L1 results</span></div><div><strong>${averageGap===null?'-':money.format(averageGap)}</strong><span>Avg. Abans unit gap vs L1</span></div>`;
  const categories={};shown.flatMap(record=>record.cards||[]).forEach(card=>{if(card.category)categories[card.category]=(categories[card.category]||0)+1});const max=Math.max(...Object.values(categories),1);document.querySelector('#categoryChart').innerHTML=Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([name,count])=>`<div><span>${name}</span><i><b style="width:${count/max*100}%"></b></i><strong>${count}</strong></div>`).join('')||'No category data.';
  renderVisualAnalytics(shown);
  document.querySelector('#count').textContent=`${shown.length} tender record${shown.length===1?'':'s'}`;
  const body=document.querySelector('#records');body.innerHTML='';if(!shown.length){body.innerHTML='<tr><td colspan="8" class="table-empty">No tender records match these filters.</td></tr>';return;}shown.forEach(record=>{const analysis=tenderAnalysis(record),row=document.createElement('tr');row.className='record-row';row.innerHTML=`<td><strong>${record.customerName||'-'}</strong></td><td>${record.accountHolderName||'-'}</td><td>${record.closingDate||'-'}</td><td>${(record.cards||[]).length}</td><td>${analysis.winner}</td><td class="${analysis.gap>0?'gap-positive':''}">${analysis.gap===null?'-':money.format(analysis.gap)}</td><td>${record.updatedAt?new Date(record.updatedAt).toLocaleString():'-'}</td><td class="row-actions"><button class="button small image">IMG</button><button class="button small edit">Edit</button><button class="button small delete">Delete</button></td>`;row.onclick=()=>{const next=row.nextElementSibling;if(next?.classList.contains('detail-row'))next.remove();else row.insertAdjacentHTML('afterend',details(record));};row.querySelector('.image').onclick=event=>{event.stopPropagation();generateImage(record);};row.querySelector('.edit').onclick=event=>{event.stopPropagation();editTender(record);};row.querySelector('.delete').onclick=event=>{event.stopPropagation();deleteTender(record);};body.append(row);});
}

function exportCsv() { const rows=[['Customer','Account Holder','Closing Date','Item','Category','Bidder','Model','Unit Price','Total Price']];filteredRecords().forEach(record=>(record.cards||[]).forEach(card=>cardAnalysis(card).quotes.forEach(quote=>rows.push([record.customerName||'',record.accountHolderName||'',record.closingDate||'',card.name||'',card.category||'',quote.name,quote.model,quote.unit,quote.total]))));const text=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));link.download='tender-report.csv';link.click();URL.revokeObjectURL(link.href);}

async function load() { try { const source = window.__FIREBASE_TENDERS__ || await fetch(`${firebaseUrl}/tenders.json`).then(response => { if (!response.ok) throw new Error('Firebase unavailable'); return response.json(); }); records=Object.entries(source||{}).map(([id,record])=>({id,...record})).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));buildFilters();draw(); } catch { document.querySelector('#records').innerHTML='<tr><td colspan="8" class="table-empty">Could not load Firebase tender records. Check internet connection and Firebase rules.</td></tr>'; } }
['search','category','model','processor','ram','storage','display','warranty','from','to','sort'].forEach(id=>document.querySelector(`#${id}`).addEventListener(id==='search'?'input':'change',draw));document.querySelector('#reload').onclick=()=>location.reload();document.querySelector('#clear').onclick=()=>{document.querySelector('#search').value='';['category','model','processor','ram','storage','display','warranty'].forEach(id=>document.querySelector(`#${id}`).value='all');document.querySelector('#from').value='';document.querySelector('#to').value='';document.querySelector('#sort').value='updated';draw();};document.querySelector('#exportCsv').onclick=exportCsv;load();
