const token=()=>localStorage.hesbahToken||'';
function currentRole(){try{return JSON.parse(atob((token().split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'))).role||''}catch{return ''}}
async function apiP(url,opt={}){if(!token())return location.href='/';opt.headers={...(opt.headers||{}),Authorization:'Bearer '+token(),'Content-Type':'application/json'};const r=await fetch('/api'+url,opt);const j=await r.json();if(r.status===401){localStorage.clear();location.href='/'}if(!r.ok)throw new Error(j.message||'خطأ');return j}
function logout(){localStorage.clear();location.href='/'}
function fmt(n){return Number(n||0).toFixed(0)+' ج.م'}
function statusAr(s){return ({pending:'تم استلام الطلب',accepted:'تم قبول الطلب',preparing:'جاري التجهيز',ready_for_pickup:'جاهز للاستلام',driver_assigned:'تم تعيين المندوب',picked_up:'تم استلام الطلب',out_for_delivery:'في الطريق',delivered:'تم التسليم',cancelled:'ملغي'})[s]||s}
async function loadOrders(){
 try{const d=await apiP('/orders');const box=document.querySelector('#orders'),role=currentRole();
 box.innerHTML=d.orders.length?d.orders.map(o=>{
 const driver=role==='driver';
 const action=driver?({'driver_assigned':['picked_up','تم الاستلام'],'picked_up':['out_for_delivery','في الطريق'],'out_for_delivery':['delivered','تم التسليم']}[o.status]||null):({pending:['accepted','قبول الطلب'],accepted:['preparing','جاري التجهيز'],preparing:['ready_for_pickup','جاهز للاستلام']}[o.status]||null);
 return `<div class="card"><div class="row"><h3>طلب #${o.number}</h3><span class="status">${statusAr(o.status)}</span></div><p>الإجمالي: <b>${fmt(o.total)}</b> · العمولة: ${fmt(o.commission)} (${o.commissionRate}%)</p><p class="muted">${o.address||'بدون عنوان'}</p><div class="row">${action?`<button class="btn" onclick="setStatus('${o.id}','${action[0]}')">${action[1]}</button>`:''}${driver||o.status!=='ready_for_pickup'?'':`<button class="btn" onclick="assignDriver('${o.id}')">اختيار مندوب</button>`}</div></div>`}).join(''):'<div class="card"><p>لا توجد طلبات حالياً.</p></div>'}catch(e){alert(e.message)}
}
async function setStatus(id,status){if(!status)return;try{await apiP('/orders/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});loadOrders()}catch(e){alert(e.message)}}
async function assignDriver(id){try{const d=await apiP('/drivers');const free=d.drivers.filter(x=>x.status!=='busy');if(!free.length)return alert('لا يوجد مندوب متاح حالياً');const names=free.map((x,i)=>`${i+1}) ${x.name} — ${x.status} — ⭐${x.rating}`).join('\n');const pick=Number(prompt('اختر رقم المندوب:\n'+names));if(!pick||!free[pick-1])return;await apiP('/orders/'+id+'/assign-driver',{method:'POST',body:JSON.stringify({driverId:free[pick-1].id})});loadOrders()}catch(e){alert(e.message)}}
async function loadDashboard(){
 try{const d=await apiP('/dashboard');document.querySelector('#kpis').innerHTML=Object.entries({الطلبات:d.stats.orders,'قيد التنفيذ':d.stats.pending,'المبيعات':fmt(d.stats.revenue),'عمولات Hesbah':fmt(d.stats.commissions),'صافي التجار':fmt(d.stats.merchantNet)}).map(([k,v])=>`<div class="card kpi"><span class="muted">${k}</span><strong>${v}</strong></div>`).join('');loadOrders()}catch(e){alert(e.message)}
}
async function loadDrivers(){try{const d=await apiP('/drivers');document.querySelector('#orders').innerHTML=d.drivers.map(x=>`<div class="card"><h3>${x.name}</h3><p>⭐ ${x.rating} · ${x.deliveries||0} توصيل</p><p>الحالة: <span class="status">${x.status}</span></p><p>GPS: ${x.lat??'-'}, ${x.lng??'-'}</p></div>`).join('')}catch(e){alert(e.message)}}
async function loadFinance(){try{const d=await apiP('/finance');document.querySelector('#orders').innerHTML=`<div class="grid"><div class="card"><h3>صافي المبيعات</h3><strong>${fmt(d.summary.subtotal)}</strong></div><div class="card"><h3>عمولة Hesbah</h3><strong>${fmt(d.summary.commission)}</strong></div><div class="card"><h3>التوصيل</h3><strong>${fmt(d.summary.delivery)}</strong></div><div class="card"><h3>صافي التاجر</h3><strong>${fmt(d.summary.merchantNet)}</strong></div></div>`}catch(e){alert(e.message)}}
const path=location.pathname;
if(path.endsWith('/admin.html'))loadDashboard();else loadOrders();
