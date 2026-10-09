function sessionKeys(role=pageRole()){const r=role||'admin';return {token:'hesbahToken_'+r,user:'hesbahUser_'+r};}
function decodeSessionRole(value){try{const raw=(value||'').split('.')[1]||'';const normalized=raw.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);return JSON.parse(atob(padded)).role||'';}catch{return '';}}
function token(){
  const role=pageRole(),keys=sessionKeys(role);
  const saved=localStorage.getItem(keys.token)||'';
  if(saved)return saved;
  const legacy=localStorage.getItem('hesbahToken')||'';
  if(role&&legacy&&decodeSessionRole(legacy)===role){
    localStorage.setItem(keys.token,legacy);
    const oldUser=localStorage.getItem('hesbahUser')||'';
    if(oldUser){try{const u=JSON.parse(oldUser);if(u?.role===role)localStorage.setItem(keys.user,oldUser);}catch{}}
    localStorage.removeItem('hesbahToken');
    localStorage.removeItem('hesbahUser');
    return legacy;
  }
  return '';
}
function currentRole(){
  const role=decodeSessionRole(token());
  if(role)return role;
  try{const u=JSON.parse(localStorage.getItem(sessionKeys().user)||'null');if(u?.role)return u.role;}catch{}
  return '';
}
function roleAr(role){return ({admin:'مدير النظام',merchant:'التاجر',driver:'مندوب التوصيل',customer:'العميل'})[role]||'غير معروف';}
function pageRole(){const p=location.pathname;return p.endsWith('/driver.html')?'driver':p.endsWith('/merchant.html')?'merchant':p.endsWith('/admin.html')?'admin':'';}
function ensurePageRole(role){const expected=pageRole();if(!expected||expected===role)return true;const box=document.querySelector('#orders');if(box)box.innerHTML='<div class="card driver-access"><h2>⚠️ الحساب غير مخصص لهذه الصفحة</h2><p>هذه صفحة <b>'+roleAr(expected)+'</b>، لكن الحساب الحالي هو <b>'+roleAr(role)+'</b>.</p><button class="btn" onclick="logout()">خروج وتسجيل الدخول بالحساب الصحيح</button></div>';stopDriverGPS();return false;}
async function apiP(url,opt={}){if(!token()){const role=pageRole();location.href=role==='merchant'?'/merchant-login.html':role==='driver'?'/driver-login.html':'/admin.html';throw new Error('سجّل الدخول للمتابعة')}opt.headers={...(opt.headers||{}),Authorization:'Bearer '+token(),'Content-Type':'application/json'};const r=await fetch('/api'+url,opt);const j=await r.json();if(r.status===401){const k=sessionKeys();localStorage.removeItem(k.token);localStorage.removeItem(k.user);localStorage.removeItem('hesbahDriverAvailable');const role=pageRole();location.href=role==='merchant'?'/merchant-login.html':role==='driver'?'/driver-login.html':'/admin.html'}if(!r.ok)throw new Error(j.message||'خطأ');return j}
function logout(){const role=pageRole(),k=sessionKeys(role);localStorage.removeItem(k.token);localStorage.removeItem(k.user);localStorage.removeItem('hesbahDriverAvailable');if(role==='merchant'||role==='admin')renderRoleLogin(role);else renderDriverLogin()}
function fmt(n){return Number(n||0).toFixed(0)+' ج.م'}
let activeView='orders';
let ordersLoadSeq=0;
async function loadCustomers(){activeView='customers';try{const d=await apiP('/users');const customers=d.users.filter(x=>x.role==='customer');document.querySelector('#orders').innerHTML=customers.length?customers.map(x=>'<div class="card"><h3>'+x.name+'</h3><p>📱 '+(x.phone||'-')+' · ✉️ '+(x.email||'-')+'</p><p>اسم المستخدم: '+x.username+'</p><p class="muted">آخر دخول: '+(x.lastLoginAt||'لم يسجل دخول بعد')+'</p></div>').join(''):'<div class="card">لا يوجد عملاء.</div>'}catch(e){alert(e.message)}}
async function loadPaymentSettings(){activeView='payments';try{const d=await apiP('/settings');const m=d.settings.paymentMethods||[];document.querySelector('#orders').innerHTML='<div class="card"><h2>طرق الدفع</h2>'+m.map((x,i)=>'<div class="card" style="margin:10px 0"><label><input type="checkbox" id="pm-'+i+'" '+(x.enabled?'checked':'')+'> تفعيل</label><input id="pmn-'+i+'" class="input" value="'+String(x.name||'').replace(/"/g,'&quot;')+'" placeholder="اسم الطريقة"><input id="pmi-'+i+'" class="input" value="'+String(x.instructions||'').replace(/"/g,'&quot;')+'" placeholder="تعليمات العميل" style="margin-top:8px"></div>').join('')+'<button class="btn" onclick="savePaymentSettings()">حفظ طرق الدفع</button></div>'}catch(e){alert(e.message)}}
async function savePaymentSettings(){try{const d=await apiP('/settings');const m=d.settings.paymentMethods||[];const paymentMethods=m.map((x,i)=>({id:x.id,name:document.querySelector('#pmn-'+i).value.trim(),enabled:document.querySelector('#pm-'+i).checked,instructions:document.querySelector('#pmi-'+i).value.trim()}));await apiP('/settings',{method:'PATCH',body:JSON.stringify({paymentMethods})});alert('تم حفظ طرق الدفع');loadPaymentSettings()}catch(e){alert(e.message)}}
async function loadDeleteRequests(){activeView='deleteRequests';try{const d=await apiP('/customer-delete-requests');document.querySelector('#orders').innerHTML=d.requests.length?d.requests.map(x=>'<div class="card"><h3>'+x.name+'</h3><p>📱 '+(x.phone||'-')+' · ✉️ '+(x.email||'-')+'</p><p>طلب الحذف: '+x.requestedAt+'</p><p class="muted">'+(x.note||'')+'</p><button class="btn" onclick="reviewDelete(\''+x.id+'\',\'approve\')">موافقة وحذف</button> <button class="btn" onclick="reviewDelete(\''+x.id+'\',\'reject\')">رفض الطلب</button></div>').join(''):'<div class="card">لا توجد طلبات حذف.</div>'}catch(e){alert(e.message)}}
async function reviewDelete(id,action){try{await apiP('/customer-delete-requests/'+id,{method:'PATCH',body:JSON.stringify({action})});loadDeleteRequests()}catch(e){alert(e.message)}}
function statusAr(s){return ({pending:'تم استلام الطلب',accepted:'تم قبول الطلب',preparing:'جاري التجهيز',ready_for_pickup:'جاهز للاستلام',driver_assigned:'تم تعيين المندوب',picked_up:'تم استلام الطلب',out_for_delivery:'في الطريق',delivered:'تم التسليم',cancelled:'ملغي'})[s]||s}
const orderStages={merchant:[['pending','تم الاستلام'],['accepted','تم قبول الطلب'],['preparing','جاري التجهيز'],['ready_for_pickup','جاهز للاستلام'],['driver_assigned','تم تعيين المندوب'],['picked_up','استلم المندوب الطلب'],['out_for_delivery','في الطريق'],['delivered','تم التسليم']],driver:[['driver_assigned','بانتظار الاستلام'],['picked_up','تم الاستلام'],['out_for_delivery','في الطريق'],['delivered','تم التسليم']],admin:[['pending','تم الاستلام'],['accepted','تم القبول'],['preparing','جاري التجهيز'],['ready_for_pickup','جاهز للاستلام'],['driver_assigned','تم تعيين المندوب'],['picked_up','تم الاستلام'],['out_for_delivery','في الطريق'],['delivered','تم التسليم']],customer:[['pending','تم الاستلام'],['accepted','تم القبول'],['preparing','جاري التجهيز'],['ready_for_pickup','جاهز للاستلام'],['driver_assigned','تم تعيين المندوب'],['picked_up','تم الاستلام'],['out_for_delivery','في الطريق'],['delivered','تم التسليم']]};
function stageBar(status,role){const stages=orderStages[role]||orderStages.customer,current=stages.findIndex(x=>x[0]===status);return '<div class="order-stages">'+stages.map((x,i)=>'<span class="'+(i<current?'done ':i===current?'current ':'')+'">'+x[1]+'</span>').join('')+'</div>'+(current>=0?'<div class="order-current">📌 <span>الحالة الحالية:</span> <strong>'+stages[current][1]+'</strong></div>':'');}
function driverTaskCard(o){const action=nextAction('driver',o.status);const map={driver_assigned:['📦','طلب جديد','الطلب جاهز للاستلام من المتجر.'],picked_up:['📦','تم استلام الطلب','ابدأ التوصيل الآن. GPS يعمل أثناء التوصيل.'],out_for_delivery:['🚗','في الطريق','أكمل التوصيل ثم أكد التسليم.'],delivered:['✅','تم التسليم','تم إنهاء الطلب بنجاح.']};const x=map[o.status]||['📦','طلب توصيل',''];const customer=o.customer||{};const customerName=customer.name||o.customerName||'غير مسجل';const customerPhone=customer.phone||o.customerPhone||'';const deliveryAddress=o.address||customer.address||'بدون عنوان';const phone=customerPhone?'<a href="tel:'+String(customerPhone).replace(/[^0-9+]/g,'')+'" dir="ltr" style="font-weight:800;text-decoration:underline">'+customerPhone+'</a>':'غير مسجل';const gps=(o.status==='picked_up'||o.status==='out_for_delivery')?'<div id="driver-gps-inline-'+o.id+'" class="driver-gps-inline">📍 GPS نشط</div>':'';const button=action?'<button class="btn driver-action-btn" onclick="setStatus(\''+o.id+'\',\''+action[0]+'\')">'+action[1]+'</button>':'';return '<div class="driver-task-card"><div class="driver-task-state">'+x[0]+' <span>'+x[1]+'</span></div><h3>طلب #'+o.number+'</h3><p class="driver-task-note">'+x[2]+'</p><div class="driver-customer-details" style="background:#f5f8fa;border:1px solid #e2e8ed;border-radius:12px;padding:12px;margin:12px 0;line-height:1.9"><p style="margin:0"><b>👤 اسم العميل:</b> '+customerName+'</p><p style="margin:0"><b>📞 رقم التليفون:</b> '+phone+'</p><p style="margin:0"><b>📍 عنوان التوصيل:</b> '+deliveryAddress+'</p></div><p><b>الإجمالي:</b> '+fmt(o.total)+'</p>'+gps+button+'</div>';} 
function nextAction(role,status){if(role==='merchant')return ({pending:['accepted','قبول الطلب'],accepted:['preparing','بدء التجهيز'],preparing:['ready_for_pickup','جاهز للاستلام']}[status]||null);if(role==='driver')return ({driver_assigned:['picked_up','استلام الطلب'],picked_up:['out_for_delivery','بدء التوصيل'],out_for_delivery:['delivered','تأكيد التسليم']}[status]||null);return null;}
async function trackOrder(id){try{const d=await apiP('/orders/'+id+'/tracking'),t=d.tracking;let box=document.querySelector('#tracking-'+id);if(!box){box=document.createElement('div');box.id='tracking-'+id;box.className='card';box.style.marginTop='10px';document.querySelector('#orders').prepend(box)}if(!t.driver||t.driver.lat==null||t.driver.lng==null){box.innerHTML='<b>📍 تتبع المندوب</b><p class="muted">المندوب لم يرسل موقعه بعد.</p>';return}const lat=t.driver.lat,lng=t.driver.lng;box.innerHTML='<b>📍 المندوب: '+t.driver.name+'</b><p>الحالة: '+statusAr(t.status)+' · آخر تحديث: '+(t.driver.updatedAt||'-')+'</p><iframe title="خريطة المندوب" style="width:100%;height:260px;border:0;border-radius:12px" src="https://www.openstreetmap.org/export/embed.html?bbox='+(lng-0.01)+'%2C'+(lat-0.01)+'%2C'+(lng+0.01)+'%2C'+(lat+0.01)+'&layer=mapnik&marker='+lat+'%2C'+lng+'"></iframe>';}catch(e){alert(e.message)}}
async function loadOrders(){activeView='orders';const seq=++ordersLoadSeq;try{const d=await apiP('/orders?_='+Date.now());if(seq!==ordersLoadSeq)return;const box=document.querySelector('#orders'),role=currentRole();if(!role){box.innerHTML='<div class="card"><h3>⚠️ لم يتم تحديد صلاحية الحساب</h3><p class="muted">سجّل الدخول بالحساب الصحيح ثم أعد فتح الصفحة.</p></div>';return;}if(!ensurePageRole(role))return;if(role==='driver'){const view=localStorage.getItem('hesbahDriverView')==='history'?'history':'active';const driverOrders=d.orders.filter(o=>o.driverId);if(view==='history'){stopDriverGPS();const history=driverOrders.filter(o=>o.status==='delivered').sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));box.innerHTML=history.length?history.map(o=>'<div class="driver-task-card"><div class="driver-task-top"><span class="driver-task-icon">✅</span><div><b>طلب #'+(o.number||o.id)+'</b><small>تم التسليم</small></div></div><div class="driver-task-info"><span>👤 '+(o.customerName||o.customer?.name||'العميل')+'</span><span>💰 '+fmt(o.total)+'</span><span>🕒 '+new Date(o.updatedAt||o.createdAt||Date.now()).toLocaleString('ar-EG')+'</span></div></div>').join(''):'<div class="card"><p>لا توجد طلبات مكتملة في سجل التسليمات.</p></div>';return;}d.orders=driverOrders.filter(o=>['driver_assigned','picked_up','out_for_delivery'].includes(o.status));if(!d.orders.some(o=>['picked_up','out_for_delivery'].includes(o.status)))stopDriverGPS();else startDriverGPS();box.innerHTML=d.orders.length?d.orders.map(o=>driverTaskCard(o)).join(''):'<div class="card"><p>لا توجد طلبات مسندة إليك حالياً.</p></div>';return;}if(role==='merchant'){const counts={all:d.orders.length,pending:d.orders.filter(o=>o.status==='pending').length,active:d.orders.filter(o=>['accepted','preparing','ready_for_pickup','driver_assigned','picked_up','out_for_delivery'].includes(o.status)).length,done:d.orders.filter(o=>o.status==='delivered').length};const stat=document.querySelector('#merchantStats');if(stat)stat.innerHTML=[['كل الطلبات',counts.all,'📦'],['طلبات جديدة',counts.pending,'🔔'],['قيد التنفيذ',counts.active,'⚙️'],['تم التسليم',counts.done,'✅']].map(x=>'<div class="merchant-stat"><span>'+x[2]+'</span><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');const filter=document.querySelector('#merchantFilter');const active=filter?.dataset.status||'all';d.orders=active==='all'?d.orders:active==='pending'?d.orders.filter(o=>o.status==='pending'):active==='active'?d.orders.filter(o=>['accepted','preparing','ready_for_pickup','driver_assigned','picked_up','out_for_delivery'].includes(o.status)):d.orders.filter(o=>o.status==='delivered');}box.innerHTML=d.orders.length?d.orders.map(o=>{const action=nextAction(role,o.status);const buttons=(role==='merchant'&&o.status==='pending'?'<button class="btn" onclick="setStatus(\''+o.id+'\',\'accepted\')">قبول الطلب</button><button class="btn light" onclick="setStatus(\''+o.id+'\',\'cancelled\')">رفض الطلب</button>':action?'<button class="btn" onclick="setStatus(\''+o.id+'\',\''+action[0]+'\')">'+action[1]+'</button>':'')+((role==='merchant'||role==='admin')&&o.status==='ready_for_pickup'?'<button class="btn alt" onclick="assignDriver(\''+o.id+'\','+(o.lat??'null')+','+(o.lng??'null')+')">اختيار مندوب</button>':'')+(role==='merchant'&&o.driverId?'<button class="btn light" onclick="trackOrder(\''+o.id+'\')">📍 متابعة المندوب</button>':'');return '<div class="card"><div class="row"><h3>طلب #'+o.number+'</h3><span class="status">'+statusAr(o.status)+'</span></div><p class="muted">👤 عرض حسب صلاحية: <b>'+roleAr(role)+'</b></p>'+stageBar(o.status,role)+'<p><b>الخطوة الحالية:</b> '+statusAr(o.status)+'</p>'+(action?'<p class="muted">الإجراء المطلوب الآن: '+action[1]+'</p>':'')+'<p>الإجمالي: <b>'+fmt(o.total)+'</b>'+(role==='admin'?' · العمولة: '+fmt(o.commission)+' ('+o.commissionRate+'%)':'')+'</p><p class="muted">'+(o.address||'بدون عنوان')+'</p><div class="row">'+buttons+'</div></div>'}).join(''):'<div class="card"><p>لا توجد طلبات في هذا التصنيف.</p></div>';for(const o of d.orders){if(o.driverId&&['driver_assigned','picked_up','out_for_delivery'].includes(o.status)&&role!=='driver')trackOrder(o.id)}}catch(e){alert(e.message)}}
let driverGpsWatch=null;
let driverGpsLastSent=0;

async function startDriverGPS(){
 if(currentRole()!=='driver'||!navigator.geolocation)return;
 if(driverGpsWatch!==null)return;
 const sendPosition=async(pos)=>{
  const nowMs=Date.now();
  if(nowMs-driverGpsLastSent<5000)return;
  driverGpsLastSent=nowMs;
  try{
   const r=await apiP('/drivers/me/location',{method:'PATCH',body:JSON.stringify({lat:pos.coords.latitude,lng:pos.coords.longitude})});
   const box=document.querySelector('#driver-gps-status');
   if(box)box.textContent='📍 GPS يعمل — آخر إرسال: '+new Date(r.location.updatedAt).toLocaleTimeString('ar-EG');
  }catch(e){
   const box=document.querySelector('#driver-gps-status');
   if(box)box.textContent='⚠️ لا يوجد طلب توصيل نشط حالياً';
  }
 };
 const box=document.querySelector('#driver-gps-status');
 if(box)box.textContent='📍 جاري تحديد موقعك...';
 navigator.geolocation.getCurrentPosition(sendPosition,()=>{
  const b=document.querySelector('#driver-gps-status');
  if(b)b.textContent='⚠️ اسمح للموقع من إعدادات المتصفح حتى يظهر موقعك للعميل';
 },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 driverGpsWatch=navigator.geolocation.watchPosition(sendPosition,()=>{
  const b=document.querySelector('#driver-gps-status');
  if(b)b.textContent='⚠️ تعذر قراءة GPS — اسمح للموقع من المتصفح';
 },{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
}
function stopDriverGPS(){
 if(driverGpsWatch!==null&&navigator.geolocation){
  navigator.geolocation.clearWatch(driverGpsWatch);
  driverGpsWatch=null;
 }
}
async function setStatus(id,status){
 if(!status)return;
 try{
  await apiP('/orders/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});
  if(currentRole()==='driver'&&['picked_up','out_for_delivery'].includes(status))startDriverGPS();
  if(currentRole()==='driver'&&status==='delivered')stopDriverGPS();
  loadOrders();
 }catch(e){alert(e.message)}
}
function driverDistanceKm(lat1,lng1,lat2,lng2){if([lat1,lng1,lat2,lng2].some(v=>v==null||!Number.isFinite(Number(v))))return null;const r=Math.PI/180,a=Math.sin((Number(lat2)-Number(lat1))*r/2)**2+Math.cos(Number(lat1)*r)*Math.cos(Number(lat2)*r)*Math.sin((Number(lng2)-Number(lng1))*r/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
async function assignDriver(id,orderLat=null,orderLng=null){try{const d=await apiP('/drivers');const free=(d.drivers||[]).filter(x=>x.status==='available').map(x=>({...x,distanceKm:driverDistanceKm(orderLat,orderLng,x.lat,x.lng)})).sort((a,b)=>(a.distanceKm??999999)-(b.distanceKm??999999));if(!free.length)return alert('لا يوجد مندوب متاح حالياً');const modal=document.createElement('div');modal.className='aether-modal-backdrop';modal.id='driver-assign-modal';modal.innerHTML='<div class="aether-modal" dir="rtl"><div class="aether-modal-head"><div><span>DELIVERY DISPATCH</span><h2>اختيار مندوب التوصيل</h2><p>المندوبون المتاحون مرتبين من الأقرب إلى الأبعد عن موقع الطلب.</p></div><button class="aether-modal-close" onclick="document.querySelector(\'#driver-assign-modal\')?.remove()">×</button></div><div class="driver-pick-list">'+free.map((x,i)=>'<button type="button" class="driver-pick '+(i===0?'nearest':'')+'" onclick="confirmDriverAssignment(\''+id+'\',\''+x.id+'\')"><span class="driver-pick-main"><b>'+(i===0?'⭐ الأقرب — ':'')+String(x.name||'مندوب')+'</b><small>📱 '+(x.phone||'-')+' · ⭐ '+(x.rating||0)+'</small></span><strong>'+(x.distanceKm==null?'الموقع غير متاح':x.distanceKm<1?Math.round(x.distanceKm*1000)+' م':x.distanceKm.toFixed(1)+' كم')+'</strong></button>').join('')+'</div><div class="aether-modal-actions"><button type="button" class="btn light" onclick="document.querySelector(\'#driver-assign-modal\')?.remove()">إلغاء</button></div></div>';document.body.appendChild(modal)}catch(e){alert(e.message)}}
async function confirmDriverAssignment(orderId,driverId){try{await apiP('/orders/'+orderId+'/assign-driver',{method:'POST',body:JSON.stringify({driverId})});document.querySelector('#driver-assign-modal')?.remove();loadOrders()}catch(e){alert(e.message)}}
async function loadDashboard(){
 activeView='dashboard';
 try{
  const [dash,ordersData]=await Promise.all([apiP('/dashboard'),apiP('/orders?_dashboard='+Date.now())]);
  const st=dash.stats||{},orders=ordersData.orders||[];
  const money=fmt;
  const labels={pending:'جديد',accepted:'مقبول',preparing:'تجهيز',ready_for_pickup:'جاهز',driver_assigned:'مندوب',picked_up:'استلام',out_for_delivery:'في الطريق',delivered:'مكتمل',cancelled:'ملغي'};
  const colors={pending:'#f59e0b',accepted:'#6366f1',preparing:'#8b5cf6',ready_for_pickup:'#06b6d4',driver_assigned:'#2563eb',picked_up:'#0ea5a5',out_for_delivery:'#7c3aed',delivered:'#10b981',cancelled:'#ef4444'};
  const active=['pending','accepted','preparing','ready_for_pickup','driver_assigned','picked_up','out_for_delivery'];
  const statusCounts={};Object.keys(labels).forEach(k=>statusCounts[k]=orders.filter(o=>o.status===k).length);
  const max=Math.max(1,...Object.values(statusCounts));
  const recent=orders.slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)).slice(0,8);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.querySelector('#kpis').innerHTML=[
   ['إجمالي الطلبات',st.orders||0,'📦','admin-kpi-purple'],
   ['قيد التشغيل',st.pending||0,'⚡','admin-kpi-blue'],
   ['المبيعات',money(st.revenue||0),'💰','admin-kpi-green'],
   ['عمولات Hesbah',money(st.commissions||0),'◈','admin-kpi-violet'],
   ['صافي التجار',money(st.merchantNet||0),'🏪','admin-kpi-cyan'],
   ['المتاجر',st.stores||0,'🏬','admin-kpi-orange'],
   ['المندوبين',st.drivers||0,'🚗','admin-kpi-indigo'],
   ['العملاء',st.customers||0,'👥','admin-kpi-pink']
  ].map(x=>'<div class="admin-command-kpi '+x[3]+'"><span class="admin-kpi-icon">'+x[2]+'</span><span class="muted">'+x[0]+'</span><strong>'+x[1]+'</strong><small>منصة Hesbah Offer</small></div>').join('');
  document.querySelector('#orders').innerHTML=
   '<div class="command-dashboard">'+
    '<div class="command-head"><div><span class="command-eyebrow">LIVE OPERATIONS</span><h2>مركز التشغيل</h2><p class="muted">نظرة لحظية على الطلبات وحركة المنصة.</p></div><div class="command-head-actions"><span class="admin-live"><i></i> النظام يعمل</span><button class="btn" onclick="loadOrders()">عرض كل الطلبات</button></div></div>'+
    '<div class="command-grid">'+
      '<div class="command-panel command-pipeline"><div class="panel-title"><div><b>Workflow</b><small>مسار الطلبات لحظة بلحظة</small></div><span>LIVE</span></div>'+
      '<div class="aether-workflow">'+Object.keys(labels).filter(k=>k!=='cancelled').map((k,idx)=>'<div class="aether-flow-step '+(statusCounts[k]?'has-orders':'')+'"><div class="aether-flow-node"><span style="background:'+colors[k]+'"></span><b>'+String(idx+1).padStart(2,'0')+'</b></div><div class="aether-flow-copy"><strong>'+labels[k]+'</strong><small>'+statusCounts[k]+' طلب</small></div>'+(idx<Object.keys(labels).filter(x=>x!=='cancelled').length-1?'<i class="aether-flow-line"></i>':'')+'</div>').join('')+'</div></div>'+
      '<div class="command-panel command-health"><div class="panel-title"><div><b>صحة المنصة</b><small>مؤشرات التشغيل الأساسية</small></div><span class="health-badge">مستقر</span></div>'+
       '<div class="health-ring"><div><strong>'+Math.max(0,orders.length-statusCounts.cancelled)+'</strong><small>طلب نشط/مكتمل</small></div></div>'+
       '<div class="health-stats"><div><span>طلبات نشطة</span><b>'+active.reduce((a,k)=>a+statusCounts[k],0)+'</b></div><div><span>مكتملة</span><b>'+statusCounts.delivered+'</b></div><div><span>ملغاة</span><b>'+statusCounts.cancelled+'</b></div></div>'+
      '</div>'+
    '</div>'+
    '<div class="command-panel command-recent"><div class="panel-title"><div><b>آخر الطلبات</b><small>آخر حركة على المنصة</small></div><button class="btn light" onclick="loadOrders()">فتح الطلبات</button></div>'+
      '<div class="command-order-table"><div class="command-order-head"><span>الطلب</span><span>الحالة</span><span>الإجمالي</span><span>آخر تحديث</span></div>'+
      (recent.length?recent.map(o=>'<div class="command-order-row"><span><b>#'+esc(o.number||o.id)+'</b><small>'+esc(o.customerName||'عميل')+'</small></span><span class="command-status" style="--status:'+colors[o.status]+'">'+(labels[o.status]||esc(o.status))+'</span><b>'+money(o.total||0)+'</b><small>'+new Date(o.updatedAt||o.createdAt||Date.now()).toLocaleString('ar-EG')+'</small></div>').join(''):'<div class="command-empty">لا توجد طلبات حتى الآن.</div>')+
      '</div></div>'+
    '<div class="command-quick-grid"><button onclick="loadDrivers()">🚗 <b>المندوبين</b><small>إدارة الأسطول والتوافر</small></button><button onclick="loadAdminStores()">🏪 <b>المتاجر</b><small>حالة المتاجر والعمولات</small></button><button onclick="loadFinance()">💰 <b>المالية</b><small>المبيعات والتسويات</small></button><button onclick="loadAdminCoupons()">🎟️ <b>العروض</b><small>الكوبونات والحملات</small></button></div>'+
   '</div>';
 }catch(e){alert(e.message)}
}
async function viewDriverDoc(id,type){
 try{
  const r=await fetch('/api/driver-applications/'+id+'/document/'+type,{headers:{Authorization:'Bearer '+token()}});
  if(!r.ok)throw new Error('تعذر فتح المستند');
  const blob=await r.blob(),url=URL.createObjectURL(blob);window.open(url,'_blank');
 }catch(e){alert(e.message)}
}
async function loadDriverApplications(){activeView='driverApplications';
 try{
  const d=await apiP('/driver-applications'),box=document.querySelector('#driverApplications');
  if(!d.applications.length){box.innerHTML='<p class="muted">لا توجد طلبات تسجيل مندوبين.</p>';return}
  const labels={selfie:'سيلفي',idFront:'البطاقة - وجه',idBack:'البطاقة - ظهر',drivingLicense:'رخصة القيادة',vehicleLicense:'رخصة المركبة'};
  box.innerHTML=d.applications.map(x=>{
   const docs=Object.keys(x.documents||{}).map(k=>`<button class="btn" onclick="viewDriverDoc('${x.id}','${k}')">${labels[k]||k}</button>`).join(' ');
   const action=x.status==='pending'?`<button class="btn" onclick="reviewDriver('${x.id}','approved')">اعتماد وتفعيل</button><button class="btn" onclick="reviewDriver('${x.id}','rejected')">رفض</button>`:x.status==='approved'?'<b>تم الاعتماد والتفعيل</b>':'<b>مرفوض</b>';
   return `<div class="card"><div class="row"><h3>${x.name}</h3><span class="status">${x.status}</span></div><p><b>الهاتف:</b> ${x.phone} · <b>الرقم القومي:</b> ${x.nationalId}</p><p><b>العنوان:</b> ${x.address}</p><p><b>المركبة:</b> ${x.vehicleType} — ${x.vehicleBrand} — ${x.vehicleModel} — لوحة ${x.vehiclePlate}</p><p class="muted">تقديم: ${x.createdAt} · IP: ${x.ip||'-'}</p><div class="row" style="gap:6px;flex-wrap:wrap">${docs}</div><div style="margin-top:10px">${action}</div></div>`;
  }).join('');
 }catch(e){alert(e.message)}
}
async function reviewDriver(id,status){
 try{
  if(status==='rejected'){const note=prompt('سبب الرفض (اختياري):')||'';await apiP('/driver-applications/'+id,{method:'PATCH',body:JSON.stringify({status,note})});}
  else{
   const username=prompt('اسم المستخدم للمندوب الجديد:');if(!username)return;
   const password=prompt('كلمة المرور (6 أحرف على الأقل):');if(!password)return;
   await apiP('/driver-applications/'+id,{method:'PATCH',body:JSON.stringify({status,username,password})});
  }
  loadDriverApplications();loadDrivers();
 }catch(e){alert(e.message)}
}
function exportDriverApplications(){
 apiP('/driver-applications').then(d=>{
  const headers=['ID','الاسم','الهاتف','الرقم القومي','العنوان','نوع المركبة','الماركة','الموديل','اللوحة','الحالة','تاريخ التقديم','IP','تاريخ المراجعة','المراجع'];
  const rows=d.applications.map(x=>[x.id,x.name,x.phone,x.nationalId,x.address,x.vehicleType,x.vehicleBrand,x.vehicleModel,x.vehiclePlate,x.status,x.createdAt,x.ip||'',x.reviewedAt||'',x.reviewedBy||'']);
  const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv='\\uFEFF'+[headers,...rows].map(r=>r.map(esc).join(',')).join('\\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='hesbah-driver-verification.csv';a.click();
 }).catch(e=>alert(e.message));
}
async function loadAdminStores(){activeView='adminStores';try{const d=await apiP('/stores');const rows=d.stores||[];document.querySelector('#orders').innerHTML='<div class="admin-list-head"><div><h2>🏪 إدارة المتاجر</h2><p class="muted">متابعة المتاجر وحالة استقبال الطلبات والعمولة.</p></div><button class="btn" onclick="addAdminStore()">+ إضافة متجر</button></div>'+(rows.length?'<div class="admin-grid">'+rows.map(s=>'<div class="admin-item-card"><div class="row"><strong>'+s.name+'</strong><span class="status '+(s.isOpen?'':'danger')+'">'+(s.isOpen?'مفتوح':'مغلق')+'</span></div><p class="muted">'+(s.category||'عام')+'</p><div class="admin-item-meta"><span>⭐ '+(s.rating||0)+'</span><span>🚚 '+fmt(s.deliveryFee||0)+'</span><span>💼 '+(s.commission||0)+'%</span></div><button class="btn light" onclick="editAdminStore(\''+s.id+'\')">تعديل المتجر</button></div>').join('')+'</div>':'<div class="card">لا توجد متاجر.</div>')}catch(e){alert(e.message)}}
function closeStoreModal(){document.querySelector('#store-create-modal')?.remove()}
async function addAdminStore(){
 closeStoreModal();
 const wrap=document.createElement('div');
 wrap.id='store-create-modal';
 wrap.className='aether-modal-backdrop';
 wrap.innerHTML='<div class="aether-modal" dir="rtl"><div class="aether-modal-head"><div><span>NEW MERCHANT</span><h2>إضافة متجر حقيقي</h2><p>إنشاء المتجر وحساب صاحبه في خطوة واحدة.</p></div><button class="aether-modal-close" onclick="closeStoreModal()">×</button></div>'+
 '<form id="store-create-form" class="aether-modal-form">'+
 '<div class="aether-form-section"><b>بيانات المتجر</b><div class="aether-form-grid">'+
 '<label>اسم المتجر *<input name="name" required placeholder="مثال: مطعم البيت"></label>'+
 '<label>التصنيف *<input name="category" required value="مطاعم" placeholder="مطاعم / بقالة / صيدلية"></label>'+
 '<label>رسوم التوصيل<input name="deliveryFee" type="number" min="0" step="0.01" value="0"></label>'+
 '<label>العمولة %<input name="commission" type="number" min="0" step="0.1" value=""></label>'+
 '<label>خط العرض<input name="lat" type="number" step="any" placeholder="اختياري"></label>'+
 '<label>خط الطول<input name="lng" type="number" step="any" placeholder="اختياري"></label>'+
 '<label class="aether-form-wide">وصف المتجر<textarea name="description" rows="3" placeholder="وصف يظهر للعملاء"></textarea></label>'+
 '</div></div>'+
 '<div class="aether-form-section"><b>حساب صاحب المتجر</b><div class="aether-form-grid">'+
 '<label>اسم صاحب المتجر *<input name="ownerName" required placeholder="الاسم بالكامل"></label>'+
 '<label>رقم الهاتف<input name="phone" placeholder="01xxxxxxxxx"></label>'+
 '<label>اسم المستخدم *<input name="username" required minlength="4" placeholder="merchant_name"></label>'+
 '<label>كلمة المرور *<input name="password" type="password" required minlength="6" placeholder="6 أحرف على الأقل"></label>'+
 '<label class="aether-form-wide">البريد الإلكتروني<input name="email" type="email" placeholder="اختياري"></label>'+
 '</div></div>'+
 '<label class="aether-check"><input name="isOpen" type="checkbox" checked> المتجر مفتوح ويستقبل الطلبات</label>'+
 '<div class="aether-modal-actions"><button type="button" class="btn light" onclick="closeStoreModal()">إلغاء</button><button class="btn" type="submit">إنشاء المتجر والحساب</button></div>'+
 '</form></div>';
 document.body.appendChild(wrap);
 const form=wrap.querySelector('#store-create-form');
 const commissionInput=form.querySelector('[name="commission"]');
 try{const settings=await apiP('/settings');commissionInput.value=settings.settings.defaultCommission??0}catch(_){commissionInput.value=0}
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const b=Object.fromEntries(new FormData(form).entries());
  const payload={name:b.name,category:b.category,description:b.description,deliveryFee:Number(b.deliveryFee||0),commission:Number(b.commission||0),
   lat:b.lat===''?null:Number(b.lat),lng:b.lng===''?null:Number(b.lng),isOpen:form.querySelector('[name="isOpen"]').checked,
   ownerName:b.ownerName,phone:b.phone,email:b.email,username:b.username,password:b.password};
  try{
   const d=await apiP('/stores',{method:'POST',body:JSON.stringify(payload)});
   closeStoreModal();loadAdminStores();
   alert('تم إنشاء المتجر وحساب صاحبه بنجاح\\n\\nاسم المستخدم: '+d.owner.username+'\\nدور الحساب: صاحب متجر');
  }catch(err){alert(err.message)}
 });
}
async function editAdminStore(id){try{const d=await apiP('/stores/'+id),s=d.store;const name=prompt('اسم المتجر',s.name);if(name===null)return;const commission=prompt('العمولة %',s.commission);const deliveryFee=prompt('رسوم التوصيل',s.deliveryFee);const isOpen=confirm('هل المتجر مفتوح ويستقبل الطلبات؟');await apiP('/stores/'+id,{method:'PATCH',body:JSON.stringify({name,commission:Number(commission),deliveryFee:Number(deliveryFee),isOpen})});loadAdminStores()}catch(e){alert(e.message)}}
async function loadAdminCoupons(){activeView='adminCoupons';try{const d=await apiP('/coupons'),rows=d.coupons||[];document.querySelector('#orders').innerHTML='<div class="admin-list-head"><div><h2>🎟️ العروض والكوبونات</h2><p class="muted">إنشاء كوبونات الخصم ومراجعة حالتها.</p></div><button class="btn" onclick="addAdminCoupon()">+ إضافة كوبون</button></div>'+(rows.length?'<div class="admin-grid">'+rows.map(c=>'<div class="admin-item-card"><div class="row"><strong>'+c.code+'</strong><span class="status '+(c.active?'':'danger')+'">'+(c.active?'فعال':'متوقف')+'</span></div><p>الخصم: <b>'+c.value+(c.type==='percent'?'%':' جنيه')+'</b></p><p class="muted">الحد الأدنى: '+fmt(c.minOrder||0)+'</p><small>الانتهاء: '+(c.expiresAt||'بدون موعد')+'</small></div>').join('')+'</div>':'<div class="card">لا توجد كوبونات.</div>')}catch(e){alert(e.message)}}
async function addAdminCoupon(){const code=prompt('كود الكوبون');if(!code)return;const type=confirm('موافق = نسبة مئوية / إلغاء = مبلغ ثابت')?'percent':'fixed';const value=prompt('قيمة الخصم');if(!value)return;try{await apiP('/coupons',{method:'POST',body:JSON.stringify({code,type,value:Number(value)})});loadAdminCoupons()}catch(e){alert(e.message)}}
async function loadDrivers(){activeView='drivers';try{const d=await apiP('/drivers');const drivers=d.drivers||[];document.querySelector('#orders').innerHTML='<div class="admin-list-head"><div><h2>🚗 إدارة المندوبين</h2><p class="muted">إضافة حسابات المندوبين ومتابعة التوفر والموقع والتوصيلات.</p></div><button class="btn" onclick="addAdminDriver()">+ إضافة مندوب</button></div>'+(drivers.length?'<div class="admin-grid">'+drivers.map(x=>{const busy=x.status==='busy';const available=x.status==='available';const label=available?'متاح':busy?'مشغول':'غير متاح';return '<div class="admin-item-card"><div class="row"><strong>🚗 '+String(x.name||'مندوب')+'</strong><span class="status '+(available?'':busy?'danger':'danger')+'">'+label+'</span></div><p class="muted">📱 '+(x.phone||'-')+'</p><div class="admin-item-meta"><span>⭐ '+(x.rating||0)+'</span><span>📦 '+(x.deliveries||0)+' توصيل</span><span>📍 '+(x.lat!=null&&x.lng!=null?'متصل':'لا يوجد GPS')+'</span></div><div style="margin-top:12px"><button class="btn '+(available?'light':'')+'" '+(busy?'disabled title="المندوب لديه طلب نشط"':'')+' onclick="toggleAdminDriverStatus(\''+x.id+'\',\''+(available?'available':'unavailable')+'\')">'+(busy?'مشغول بطلب نشط':available?'إيقاف التوفر':'تفعيل التوفر')+'</button></div></div>'}).join('')+'</div>':'<div class="card">لا يوجد مندوبون حتى الآن.</div>')}catch(e){alert(e.message)}}
async function toggleAdminDriverStatus(id,currentStatus){const next=currentStatus==='available'?'unavailable':'available';try{await apiP('/drivers/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status:next})});await loadDrivers()}catch(e){alert(e.message)}}
async function addAdminDriver(){const wrap=document.createElement('div');wrap.className='aether-modal-backdrop';wrap.id='driver-create-modal';wrap.innerHTML='<div class="aether-modal" dir="rtl"><div class="aether-modal-head"><div><span>NEW DRIVER</span><h2>إضافة مندوب جديد</h2><p>إنشاء حساب المندوب وربطه تلقائياً بملف التوصيل.</p></div><button class="aether-modal-close" onclick="document.querySelector(\'#driver-create-modal\')?.remove()">×</button></div><form id="driver-create-form" class="aether-modal-form"><div class="aether-form-grid"><label>اسم المندوب *<input name="name" required placeholder="الاسم بالكامل"></label><label>رقم الهاتف<input name="phone" placeholder="01xxxxxxxxx"></label><label>اسم المستخدم *<input name="username" required minlength="4" placeholder="driver_name"></label><label>كلمة المرور *<input name="password" type="password" required minlength="6" placeholder="6 أحرف على الأقل"></label><label class="aether-form-wide">البريد الإلكتروني<input name="email" type="email" placeholder="اختياري"></label></div><div class="aether-modal-actions"><button type="button" class="btn light" onclick="document.querySelector(\'#driver-create-modal\')?.remove()">إلغاء</button><button class="btn" type="submit">إنشاء المندوب</button></div></form></div>';document.body.appendChild(wrap);wrap.querySelector('#driver-create-form').addEventListener('submit',async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target).entries());try{const d=await apiP('/users',{method:'POST',body:JSON.stringify({name:b.name,phone:b.phone,email:b.email,username:b.username,password:b.password,role:'driver'})});wrap.remove();await loadDrivers();alert('تم إنشاء المندوب بنجاح\\n\\nاسم المستخدم: '+d.user.username+'\\nيمكنه الدخول من صفحة المندوب.')}catch(err){alert(err.message)}})}
async function loadMerchantPayments(){activeView='merchantPayments';try{const u=JSON.parse(localStorage.getItem(sessionKeys().user)||'{}'),d=await apiP('/stores/'+u.storeId),s=d.store;const fallback=[{id:'cash',name:'الدفع عند الاستلام',enabled:true,instructions:'الدفع نقدًا عند استلام الطلب'},{id:'card',name:'بطاقة بنكية',enabled:false,instructions:'الدفع بالبطاقة عند إتمام الطلب'},{id:'wallet',name:'محفظة إلكترونية',enabled:false,instructions:'اكتب تعليمات المحفظة هنا'}];const methods=Array.isArray(s.paymentMethods)?s.paymentMethods:fallback;const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');document.querySelector('#orders').innerHTML='<div class="merchant-editor card"><div class="row"><div><h2>💳 طرق الدفع</h2><p class="muted">حدد طرق الدفع التي تظهر لعملاء متجرك فقط.</p></div><span class="status">متجر: '+esc(s.name)+'</span></div>'+methods.map((x,i)=>'<div class="card" style="margin:12px 0"><label><input type="checkbox" id="m-pm-'+i+'" '+(x.enabled?'checked':'')+'> تفعيل '+esc(x.name)+'</label><input id="m-pmn-'+i+'" class="input" value="'+esc(x.name)+'" placeholder="اسم طريقة الدفع"><textarea id="m-pmi-'+i+'" class="input" style="margin-top:8px" placeholder="تعليمات العميل">'+esc(x.instructions||'')+'</textarea></div>').join('')+'<button class="btn" onclick="saveMerchantPayments('+JSON.stringify(methods.map(x=>x.id))+')">حفظ طرق الدفع</button></div>'}catch(e){alert(e.message)}}async function saveMerchantPayments(ids){try{const methods=ids.map((id,i)=>({id,name:document.querySelector('#m-pmn-'+i).value.trim(),enabled:document.querySelector('#m-pm-'+i).checked,instructions:document.querySelector('#m-pmi-'+i).value.trim()}));const u=JSON.parse(localStorage.getItem(sessionKeys().user)||'{}');await apiP('/stores/'+u.storeId,{method:'PATCH',body:JSON.stringify({paymentMethods:methods})});alert('تم حفظ طرق الدفع لمتجرك');loadMerchantPayments()}catch(e){alert(e.message)}}async function loadMerchantStore(){activeView='store';try{const u=JSON.parse(localStorage.getItem(sessionKeys().user)||'{}'),d=await apiP('/stores/'+u.storeId);const s=d.store,esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));document.querySelector('#orders').innerHTML='<div class="merchant-editor card"><div class="row"><div><h2>🏪 بيانات المتجر</h2><p class="muted">الصورة والبيانات التي تظهر للعملاء.</p></div><span class="status '+(s.isOpen?'':'danger')+'">'+(s.isOpen?'🟢 مفتوح':'🔴 مغلق')+'</span></div><div class="merchant-store-image-box"><div class="merchant-store-preview">'+(s.image?'<img src="'+esc(s.image)+'" alt="صورة المتجر">':'🏪')+'</div><div><label class="merchant-upload-btn">📷 رفع صورة المحل<input id="ms-image" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><p class="muted">ستظهر الصورة للعملاء في قائمة المطاعم وصفحة المتجر.</p><small id="ms-upload-status"></small></div></div><div class="merchant-form-grid"><label>اسم المتجر<input id="ms-name" class="input" value="'+esc(s.name)+'"></label><label>التصنيف<input id="ms-category" class="input" value="'+esc(s.category)+'"></label><label>رسوم التوصيل<input id="ms-fee" class="input" type="number" value="'+Number(s.deliveryFee||0)+'"></label><label>خط العرض<input id="ms-lat" class="input" type="number" step="any" value="'+(s.lat??'')+'"></label><label>خط الطول<input id="ms-lng" class="input" type="number" step="any" value="'+(s.lng??'')+'"></label><label style="grid-column:1/-1">وصف المتجر<textarea id="ms-desc" class="input">'+esc(s.description)+'</textarea></label></div><label class="merchant-switch"><input id="ms-open" type="checkbox" '+(s.isOpen?'checked':'')+'> استقبال الطلبات متاح</label><button class="btn" onclick="saveMerchantStore()">حفظ بيانات المتجر</button></div>';document.querySelector('#ms-image').onchange=uploadMerchantStoreImage}catch(e){alert(e.message)}}
async function uploadMerchantStoreImage(e){const file=e.target.files?.[0];if(!file)return;if(file.size>8*1024*1024)return alert('حجم الصورة أكبر من 8MB');const st=document.querySelector('#ms-upload-status');st.textContent='جاري الرفع...';try{const fd=new FormData();fd.append('image',file);const r=await fetch('/api/stores/image',{method:'POST',headers:{Authorization:'Bearer '+token()},body:fd});const d=await r.json();if(!r.ok)throw new Error(d.message||'فشل رفع الصورة');st.textContent='✓ تم رفع الصورة';loadMerchantStore()}catch(e){st.textContent='';alert(e.message)}}
async function saveMerchantStore(){try{const u=JSON.parse(localStorage.getItem(sessionKeys().user)||'{}');await apiP('/stores/'+u.storeId,{method:'PATCH',body:JSON.stringify({name:document.querySelector('#ms-name').value.trim(),category:document.querySelector('#ms-category').value.trim(),description:document.querySelector('#ms-desc').value.trim(),deliveryFee:Number(document.querySelector('#ms-fee').value||0),lat:Number(document.querySelector('#ms-lat').value||0)||null,lng:Number(document.querySelector('#ms-lng').value||0)||null,isOpen:document.querySelector('#ms-open').checked})});alert('تم حفظ بيانات المتجر');loadMerchantStore()}catch(e){alert(e.message)}}async function loadMerchantProducts(){activeView='products';try{const d=await apiP('/products/manage');const rows=d.products||[];document.querySelector('#orders').innerHTML='<div class="merchant-products-head"><div><h2>🛍️ منتجات المتجر</h2><p class="muted">إضافة المنتجات وتعديل السعر والمخزون والتوفر.</p></div><button class="btn" onclick="addMerchantProduct()">+ إضافة منتج</button></div><div class="merchant-products-grid">'+(rows.length?rows.map(p=>'<div class="merchant-product-card"><div class="row"><strong>'+p.name+'</strong><span class="status '+(!p.available?'danger':'')+'">'+(p.available?'متاح':'موقوف')+'</span></div><p class="muted">'+(p.description||'بدون وصف')+'</p><div class="merchant-product-price">'+fmt(p.price)+'</div><small>المخزون: '+(Number(p.stock)<0?'غير محدود':p.stock)+' · '+(p.category||'عام')+'</small><div class="row" style="margin-top:12px"><button type="button" class="btn light" data-product-action="edit" data-product-id="'+String(p.id).replace(/"/g,'&quot;')+'">تعديل</button><button type="button" class="btn '+(p.available?'alt':'')+'" data-product-action="toggle" data-product-id="'+String(p.id).replace(/"/g,'&quot;')+'" data-available="'+(!p.available)+'">'+(p.available?'إيقاف':'تفعيل')+'</button><button type="button" class="btn danger" data-product-action="delete" data-product-id="'+String(p.id).replace(/"/g,'&quot;')+'" data-product-name="'+String(p.name||'').replace(/"/g,'&quot;')+'">حذف</button></div></div>').join(''):'<div class="card">لا توجد منتجات.</div>')+'</div>'}catch(e){alert(e.message)}}async function addMerchantProduct(){openMerchantProductModal(null)}
document.addEventListener('click',function(e){const b=e.target.closest('[data-product-action]');if(!b)return;const id=b.dataset.productId;if(b.dataset.productAction==='edit')editMerchantProduct(id);else if(b.dataset.productAction==='toggle')toggleMerchantProduct(id,b.dataset.available==='true');else if(b.dataset.productAction==='delete')deleteMerchantProduct(id,b.dataset.productName)});

async function editMerchantProduct(id){openMerchantProductModal(id)}

async function toggleMerchantProduct(id,available){
 try{await apiP('/products/'+id,{method:'PATCH',body:JSON.stringify({available})});loadMerchantProducts()}
 catch(e){alert(e.message)}
}

async function deleteMerchantProduct(id,name){
 if(!confirm('حذف المنتج «'+name+'» نهائياً؟'))return;
 try{await apiP('/products/'+id,{method:'DELETE'});loadMerchantProducts()}
 catch(e){alert(e.message)}
}

let merchantProductUpload=null;

async function openMerchantProductModal(id){
 try{
  let p=null;
  if(id){
   const d=await apiP('/products/manage');
   p=(d.products||[]).find(x=>x.id===id);
   if(!p)throw new Error('المنتج غير موجود');
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const image=p?.image||'';
  const modal=document.createElement('div');
  modal.id='merchantProductModal';
  modal.className='merchant-product-modal-backdrop';
  modal.innerHTML='<section class="merchant-product-modal">'+
   '<div class="merchant-product-modal-head"><div><span>PRODUCT MANAGEMENT</span><h2>'+(p?'تعديل المنتج':'إضافة منتج جديد')+'</h2><p>بيانات المنتج والصورة والسعر والمخزون.</p></div><button type="button" class="merchant-product-close" onclick="closeMerchantProductModal()">×</button></div>'+
   '<form id="merchantProductForm" class="merchant-product-form">'+
   '<div class="merchant-product-image-box"><div id="merchantProductPreview" class="merchant-product-preview">'+(image?'<img src="'+esc(image)+'" alt="صورة المنتج">':'<span>🖼️</span><small>لا توجد صورة</small>')+'</div><div><label class="merchant-upload-btn">📷 اختيار صورة<input id="mp-image" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><p class="muted">JPG أو PNG أو WEBP — حتى 5MB</p><small id="mp-upload-status"></small></div></div>'+
   '<div class="merchant-product-form-grid">'+
   '<label>اسم المنتج<input id="mp-name" class="input" required value="'+esc(p?.name||'')+'"></label>'+
   '<label>التصنيف<input id="mp-category" class="input" value="'+esc(p?.category||'عام')+'"></label>'+
   '<label>السعر<input id="mp-price" class="input" type="number" min="0.01" step="0.01" required value="'+(p?.price??'')+'"></label>'+
   '<label>السعر القديم<input id="mp-old-price" class="input" type="number" min="0" step="0.01" value="'+(p?.oldPrice||'')+'"></label>'+
   '<label>المخزون<input id="mp-stock" class="input" type="number" min="-1" step="1" value="'+(p?.stock??-1)+'"></label>'+
   '<label class="merchant-product-available"><input id="mp-available" type="checkbox" '+(p?.available!==false?'checked':'')+'> المنتج متاح للطلب</label>'+
   '<label class="merchant-product-wide">الوصف<textarea id="mp-description" class="input" rows="4">'+esc(p?.description||'')+'</textarea></label>'+
   '</div>'+
   '<div class="merchant-product-modal-actions"><button type="button" class="btn light" onclick="closeMerchantProductModal()">إلغاء</button><button type="submit" class="btn">'+(p?'حفظ التعديلات':'إضافة المنتج')+'</button>'+(p?'<button type="button" class="btn danger" onclick="deleteMerchantProduct('+JSON.stringify(p.id)+','+JSON.stringify(p.name)+')">حذف المنتج</button>':'')+'</div>'+
   '</form></section>';
  document.body.appendChild(modal);
  merchantProductUpload=null;
  document.querySelector('#mp-image').addEventListener('change',async e=>{
   const file=e.target.files?.[0];if(!file)return;
   const preview=document.querySelector('#merchantProductPreview');
   if(file.size>5*1024*1024)return alert('حجم الصورة يجب ألا يتجاوز 5MB');
   if(!/^image\/(jpeg|png|webp)$/.test(file.type))return alert('اختر JPG أو PNG أو WEBP');
   preview.innerHTML='<img src="'+URL.createObjectURL(file)+'" alt="معاينة">';
   const status=document.querySelector('#mp-upload-status');status.textContent='جاري رفع الصورة...';
   try{
    const fd=new FormData();fd.append('image',file);
    const r=await fetch('/api/products/image',{method:'POST',headers:{Authorization:'Bearer '+token()},body:fd});
    const d=await r.json();if(!r.ok)throw new Error(d.message||'تعذر رفع الصورة');
    merchantProductUpload=d.image;status.textContent='✓ تم رفع الصورة';
   }catch(err){status.textContent='';alert(err.message)}
  });
  document.querySelector('#merchantProductForm').addEventListener('submit',async e=>{
   e.preventDefault();
   const body={name:document.querySelector('#mp-name').value.trim(),category:document.querySelector('#mp-category').value.trim()||'عام',
    price:Number(document.querySelector('#mp-price').value),oldPrice:Number(document.querySelector('#mp-old-price').value||0),
    stock:Number(document.querySelector('#mp-stock').value),description:document.querySelector('#mp-description').value.trim(),
    available:document.querySelector('#mp-available').checked};
   if(!body.name||!body.price||body.price<=0)return alert('أدخل اسم المنتج وسعراً صحيحاً');
   if(merchantProductUpload!==null)body.image=merchantProductUpload;
   try{
    await apiP(p?'/products/'+p.id:'/products',{method:p?'PATCH':'POST',body:JSON.stringify(body)});
    closeMerchantProductModal();loadMerchantProducts();
   }catch(err){alert(err.message)}
  });
 }catch(e){alert(e.message)}
}

function closeMerchantProductModal(){
 const m=document.querySelector('#merchantProductModal');if(m)m.remove();
 merchantProductUpload=null;
}
async function loadFinance(){activeView='finance';try{const d=await apiP('/finance'),s=d.summary||{},sett=d.settlements||[];document.querySelector('#orders').innerHTML='<div class="merchant-finance"><div class="merchant-finance-head"><div><h2>💰 الحساب المالي</h2><p class="muted">ملخص مستحقات متجرك وحركة التسويات.</p></div><span class="status">عدد الطلبات المسلّمة: '+Number(s.orders||0)+'</span></div><div class="merchant-finance-grid"><div class="card"><h3>صافي المبيعات</h3><strong>'+fmt(s.subtotal||0)+'</strong></div><div class="card"><h3>التوصيل</h3><strong>'+fmt(s.delivery||0)+'</strong></div><div class="card"><h3>صافي المستحق</h3><strong>'+fmt(s.merchantNet||0)+'</strong></div></div><div class="card merchant-settlements"><h3>التسويات المالية</h3>'+(sett.length?sett.map(x=>'<div class="row"><span>'+String(x.id||'تسوية')+'</span><strong>'+fmt(x.amount||x.total||0)+'</strong></div>').join(''):'<p class="muted">لا توجد تسويات مسجلة حتى الآن.</p>')+'</div></div>'}catch(e){alert(e.message)}}function renderRoleLogin(expected){
  const label=expected==='merchant'?'التاجر':expected==='admin'?'مدير النظام':'مستخدم';
  const icon=expected==='merchant'?'🏪':'🔐';
  document.body.innerHTML='<main class="driver-login-page"><section class="driver-login-card"><div class="driver-login-brand">HESBAH <span>'+expected.toUpperCase()+'</span></div><div class="driver-login-bike">'+icon+'</div><h1>تسجيل دخول '+label+'</h1><p>أدخل بيانات الحساب للوصول إلى لوحة التحكم.</p><form id="roleLoginForm"><input id="roleLoginUser" class="input" placeholder="اسم المستخدم" autocomplete="username" required><input id="roleLoginPass" class="input" type="password" placeholder="كلمة المرور" autocomplete="current-password" required><button class="btn" type="submit">دخول إلى لوحة التحكم</button></form><div id="roleLoginError" class="driver-login-error"></div></section></main>';
  document.querySelector('#roleLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();const err=document.querySelector('#roleLoginError');err.textContent='جاري تسجيل الدخول...';
    try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.querySelector('#roleLoginUser').value.trim(),password:document.querySelector('#roleLoginPass').value})});const d=await r.json();if(!r.ok)throw new Error(d.message||'بيانات الدخول غير صحيحة');if(d.user?.role!==expected)throw new Error('هذا الحساب ليس حساب '+label+'.');const k=sessionKeys(expected);localStorage.setItem(k.token,d.token);localStorage.setItem(k.user,JSON.stringify(d.user));localStorage.removeItem('hesbahToken');localStorage.removeItem('hesbahUser');location.reload()}catch(e){err.textContent=e.message}
  });
}
function renderDriverLogin(){
  document.body.innerHTML=`
  <main class="driver-login-page">
    <section class="driver-login-card">
      <div class="driver-login-brand">HESBAH <span>DRIVER</span></div>
      <div class="driver-login-bike">🏍️</div>
      <h1>تسجيل دخول مندوب التوصيل</h1>
      <p>سجّل دخولك للوصول إلى طلباتك ومهام التوصيل.</p>
      <form id="driverLoginForm">
        <input id="driverLoginUser" class="input" placeholder="اسم المستخدم" autocomplete="username" required>
        <input id="driverLoginPass" class="input" type="password" placeholder="كلمة المرور" autocomplete="current-password" required>
        <button class="btn" type="submit">دخول إلى مركز التوصيل</button>
      </form>
      <div id="driverLoginError" class="driver-login-error"></div>
    </section>
  </main>`;
  document.querySelector('#driverLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const err=document.querySelector('#driverLoginError');err.textContent='جاري تسجيل الدخول...';
    try{
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.querySelector('#driverLoginUser').value.trim(),password:document.querySelector('#driverLoginPass').value})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||'بيانات الدخول غير صحيحة');
      if(d.user?.role!=='driver')throw new Error('هذا الحساب ليس حساب مندوب توصيل.');
      const k=sessionKeys('driver');
      localStorage.setItem(k.token,d.token);
      localStorage.setItem(k.user,JSON.stringify(d.user));
      localStorage.removeItem('hesbahToken');
      localStorage.removeItem('hesbahUser');
      location.reload();
    }catch(e){err.textContent=e.message}
  });
}
function initAdminNavigation(){
 if(!location.pathname.endsWith('/admin.html'))return;
 const actions={
  dashboard:()=>loadDashboard(),orders:()=>loadOrders(),drivers:()=>loadDrivers(),
  applications:()=>loadDriverApplications(),finance:()=>loadFinance(),stores:()=>loadAdminStores(),
  customers:()=>loadCustomers(),payments:()=>loadPaymentSettings(),deletes:()=>loadDeleteRequests(),coupons:()=>loadAdminCoupons()
 };
 document.querySelectorAll('[data-admin-action]').forEach(btn=>{
  btn.addEventListener('click',e=>{e.preventDefault();const fn=actions[btn.dataset.adminAction];if(fn)fn();});
 });
}
initAdminNavigation();
const path=location.pathname;
const expectedPageRole=pageRole();
const savedRole=currentRole();
if(expectedPageRole&&expectedPageRole!=='driver'&&(!token()||savedRole!==expectedPageRole)){
  renderRoleLogin(expectedPageRole);
}else if(path.endsWith('/driver.html')&&!token())renderDriverLogin();
else if(path.endsWith('/admin.html'))loadDashboard();else loadOrders();
setInterval(()=>{if(token()&&document.querySelector('#orders')&&activeView==='orders')loadOrders()},5000);
