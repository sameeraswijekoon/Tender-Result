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

// Image export controls: orientation and resolution are selected in the report toolbar.
async function generateImage(record) {
  const orientation = document.querySelector('#imageOrientation')?.value || 'portrait';
  const quality = Number(document.querySelector('#imageSize')?.value || 2);
  const W = orientation === 'landscape' ? 1600 : 900;
  const H = orientation === 'landscape' ? 900 : 1600;
  const scale = Math.max(1, Math.min(3, quality));
  const margin = orientation === 'landscape' ? 44 : 36;
  const analysis = tenderAnalysis(record);
  const items = analysis.items.length ? analysis.items : [{card:{name:'No items',qty:'-'},analysis:{quotes:[]}}];
  const pages = [];
  const wrapText = (ctx, text, maxWidth) => {
    const words = String(text ?? '-').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; }
      else line = next;
    });
    if (line) lines.push(line);
    return lines.length ? lines : ['-'];
  };
  const fieldsFor = card => [
    ['Quantity', card.qty], ['Category', card.category], ['Quoted Model', card.model],
    ['Processor', card.processor], ['RAM', card.ram], ['Storage', card.storage],
    ['Display / Monitor', card.display || card.monitor], ['Warranty', card.warranty],
    ['Local Purchase 1', card.localPurchase1], ['Local Purchase 2', card.localPurchase2],
    ['Local Purchase 3', card.localPurchase3]
  ].filter(([label,value]) => value !== undefined && value !== null && String(value).trim() !== '');
  items.forEach((item, itemIndex) => {
    const card = item.card;
    const quotes = item.analysis.quotes || [];
    // Split quotes only when needed; the complete bidder list is preserved across pages.
    const headerH = orientation === 'landscape' ? 190 : 220;
    const specsH = orientation === 'landscape' ? 430 : 470;
    const quoteH = orientation === 'landscape' ? 190 : 225;
    const topY = headerH;
    const firstAvailable = H - (topY + 78 + specsH + 45 + 80);
    const nextAvailable = H - (topY + 78 + 60 + 45 + 80);
    const firstCapacity = Math.max(1, Math.floor(firstAvailable / quoteH));
    const nextCapacity = Math.max(1, Math.floor(nextAvailable / quoteH));
    if (!quotes.length) pages.push({card,quotes:[],itemIndex,first:true});
    else {
      let offset = 0;
      while (offset < quotes.length) {
        const first = offset === 0;
        const capacity = first ? firstCapacity : nextCapacity;
        pages.push({card,quotes:quotes.slice(offset,offset+capacity),itemIndex,first});
        offset += capacity;
      }
    }
  });
  function drawPage(page, pageNo) {
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f4f6fa'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,orientation === 'landscape' ? 140 : 165);
    ctx.fillStyle = '#7b1d83'; ctx.fillRect(0,0,10,orientation === 'landscape' ? 140 : 165);
    ctx.fillStyle = '#28232b'; ctx.font = 'bold ' + (orientation === 'landscape' ? 34 : 36) + 'px Arial';
    ctx.fillText('Tender Result', margin, 48);
    ctx.fillStyle = '#65146d'; ctx.font = 'bold ' + (orientation === 'landscape' ? 26 : 27) + 'px Arial';
    const customerLines = wrapText(ctx, record.customerName || 'Customer', W - margin*2);
    ctx.fillText(customerLines[0], margin, 86);
    ctx.fillStyle = '#5e5661'; ctx.font = '20px Arial';
    ctx.fillText('Account: ' + String(record.accountHolderName || '-'), margin, 120);
    ctx.fillText('Closing Date: ' + String(record.closingDate || '-'), margin, 148);
    let y = orientation === 'landscape' ? 165 : 190;
    ctx.fillStyle = '#efe7f2'; ctx.fillRect(margin,y,W-margin*2,62);
    ctx.fillStyle = '#65146d'; ctx.font = 'bold 23px Arial';
    ctx.fillText('ITEM ' + (page.itemIndex+1) + ': ' + String(page.card.name || 'Item'), margin+18,y+27);
    ctx.fillStyle = '#28232b'; ctx.font = '20px Arial';
    ctx.fillText('Quantity: ' + String(page.card.qty || '-'), margin+18,y+52);
    y += 78;
    if (page.first) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(margin,y,W-margin*2,orientation === 'landscape' ? 410 : 450);
      ctx.strokeStyle = '#dce2e9'; ctx.strokeRect(margin,y,W-margin*2,orientation === 'landscape' ? 410 : 450);
      ctx.fillStyle = '#28232b'; ctx.font = 'bold 23px Arial'; ctx.fillText('SPECIFICATIONS',margin+18,y+32);
      const fields = fieldsFor(page.card);
      const labelW = orientation === 'landscape' ? 190 : 190;
      const valueW = W - margin*2 - labelW - 55;
      let sy = y+65;
      const lineH = orientation === 'landscape' ? 25 : 29;
      fields.forEach(([label,value]) => {
        ctx.fillStyle = '#5e5661'; ctx.font = 'bold 17px Arial';
        ctx.fillText(label,margin+18,sy);
        ctx.fillStyle = '#28232b'; ctx.font = '18px Arial';
        const lines = wrapText(ctx,value,valueW);
        lines.forEach((line,index) => ctx.fillText(line,margin+labelW,sy+index*lineH));
        sy += Math.max(lineH+3, lines.length*lineH+3);
      });
      y += (orientation === 'landscape' ? 430 : 470);
    } else {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(margin,y,W-margin*2,45);
      ctx.fillStyle = '#5e5661'; ctx.font = '20px Arial';
      ctx.fillText('Bidder prices continued',margin+18,y+29);
      y += 60;
    }
    ctx.fillStyle = '#28232b'; ctx.font = 'bold 24px Arial'; ctx.fillText('BIDDER PRICE COMPARISON',margin,y+27);
    y += 45;
    const cardH = orientation === 'landscape' ? 190 : 225;
    page.quotes.forEach((quote,index) => {
      const isWinner = page.first && index === 0;
      ctx.fillStyle = isWinner ? '#e6f6ec' : '#ffffff';
      ctx.fillRect(margin,y,W-margin*2,cardH-10);
      ctx.strokeStyle = '#dce2e9'; ctx.strokeRect(margin,y,W-margin*2,cardH-10);
      ctx.fillStyle = isWinner ? '#126b42' : '#65146d';
      ctx.font = 'bold 23px Arial'; ctx.fillText('L' + (page.quotes.indexOf(quote) + 1 + pageRankOffset(page)),margin+16,y+30);
      const innerX = margin+82;
      const contentWidth = W - innerX - margin - 18;
      ctx.fillStyle = '#28232b'; ctx.font = 'bold 21px Arial';
      const nameLines = wrapText(ctx,quote.name || 'Unnamed bidder',contentWidth);
      ctx.fillText(nameLines[0],innerX,y+30);
      if (nameLines[1]) ctx.fillText(nameLines[1],innerX,y+52);
      ctx.fillStyle = '#5e5661'; ctx.font = '16px Arial'; ctx.fillText('MODEL',margin+16,y+80);
      ctx.fillStyle = '#28232b'; ctx.font = '18px Arial';
      const modelLines = wrapText(ctx,quote.model || '-',contentWidth);
      ctx.fillText(modelLines[0],innerX,y+80);
      if (modelLines[1]) ctx.fillText(modelLines[1],innerX,y+101);
      if (orientation === 'landscape') {
        ctx.fillStyle = '#5e5661'; ctx.font = 'bold 16px Arial'; ctx.fillText('UNIT PRICE',margin+16,y+145);
        ctx.fillStyle = '#28232b'; ctx.font = 'bold 19px Arial'; ctx.fillText(money.format(quote.unit),innerX,y+145);
        ctx.fillStyle = '#5e5661'; ctx.font = 'bold 16px Arial'; ctx.fillText('TOTAL PRICE',W/2+60,y+145);
        ctx.fillStyle = '#28232b'; ctx.font = 'bold 19px Arial'; ctx.fillText(money.format(quote.total),W/2+210,y+145);
      } else {
        ctx.fillStyle = '#5e5661'; ctx.font = 'bold 16px Arial'; ctx.fillText('UNIT PRICE',margin+16,y+145);
        ctx.fillStyle = '#28232b'; ctx.font = 'bold 21px Arial'; ctx.fillText(money.format(quote.unit),innerX,y+145);
        ctx.fillStyle = '#5e5661'; ctx.font = 'bold 16px Arial'; ctx.fillText('TOTAL PRICE',margin+16,y+188);
        ctx.fillStyle = '#28232b'; ctx.font = 'bold 21px Arial'; ctx.fillText(money.format(quote.total),innerX,y+188);
      }
      y += cardH;
    });
    ctx.fillStyle = '#746b76'; ctx.font = '16px Arial';
    ctx.fillText('Page ' + pageNo + ' of ' + pages.length,margin,H-18);
    return canvas;
  }
  // Keep L1 ranks correct across pages for each item.
  function pageRankOffset(page) {
    let offset = 0;
    for (let i=0;i<pages.length;i++) {
      if (pages[i] === page) break;
      if (pages[i].itemIndex === page.itemIndex) offset += pages[i].quotes.length;
    }
    return offset;
  }
  for (let i=0;i<pages.length;i++) {
    const canvas = drawPage(pages[i],i+1);
    const link = document.createElement('a');
    link.download = 'Tender-' + String(record.customerName || 'Result').replace(/[^a-z0-9]+/gi,'-') + '-' + orientation + '-' + i18nSize(scale) + '-Page-' + (i+1) + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    await new Promise(resolve => setTimeout(resolve,300));
  }
  function i18nSize(value) { return value === 1 ? 'standard' : value === 1.5 ? 'high' : 'ultra'; }
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
