const token=()=>localStorage.hesbahToken||'';
function currentRole(){
  try{
    const raw=token().split('.')[1]||'';
    const normalized=raw.replace(/-/g,'+').replace(/_/g,'/');
    const padded=normalized+'='.repeat((4-normalized.length%4)%4);
    const payload=JSON.parse(atob(padded));
    if(payload.role)return payload.role;
  }catch{}
  try{
    const u=JSON.parse(localStorage.hesbahUser||'null');
    if(u?.role)return u.role;
  }catch{}
  return '';
}
function roleAr(role){return ({admin:'مدير النظام',merchant:'التاجر',driver:'مندوب التوصيل',customer:'العميل'})[role]||'غير معروف';}
function pageRole(){const p=location.pathname;return p.endsWith('/driver.html')?'driver':p.endsWith('/merchant.html')?'merchant':p.endsWith('/admin.html')?'admin':'';}
function ensurePageRole(role){const expected=pageRole();if(!expected||expected===role)return true;const box=document.querySelector('#orders');if(box)box.innerHTML='<div class="card driver-access"><h2>⚠️ الحساب غير مخصص لهذه الصفحة</h2><p>هذه صفحة <b>'+roleAr(expected)+'</b>، لكن الحساب الحالي هو <b>'+roleAr(role)+'</b>.</p><button class="btn" onclick="logout()">خروج وتسجيل الدخول بالحساب الصحيح</button></div>';stopDriverGPS();return false;}
async function apiP(url,opt={}){if(!token())return location.href='/';opt.headers={...(opt.headers||{}),Authorization:'Bearer '+token(),'Content-Type':'application/json'};const r=await fetch('/api'+url,opt);const j=await r.json();if(r.status===401){localStorage.clear();location.href='/'}if(!r.ok)throw new Error(j.message||'خطأ');return j}
function logout(){localStorage.removeItem('hesbahToken');localStorage.removeItem('hesbahUser');localStorage.removeItem('hesbahDriverAvailable');location.href=pageRole()==='merchant'?'/merchant.html':pageRole()==='admin'?'/admin.html':'/driver.html'}
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
function driverTaskCard(o){const action=nextAction('driver',o.status);const map={driver_assigned:['📦','طلب جديد','الطلب جاهز للاستلام من المتجر.'],picked_up:['📦','تم استلام الطلب','ابدأ التوصيل الآن. GPS يعمل أثناء التوصيل.'],out_for_delivery:['🚗','في الطريق','أكمل التوصيل ثم أكد التسليم.'],delivered:['✅','تم التسليم','تم إنهاء الطلب بنجاح.']};const x=map[o.status]||['📦','طلب توصيل',''];return '<div class="driver-task-card"><div class="driver-task-state">'+x[0]+' <span>'+x[1]+'</span></div><h3>طلب #'+o.number+'</h3><p class="driver-task-note">'+x[2]+'</p><p><b>العنوان:</b> '+(o.address||'بدون عنوان')+'</p><p><b>الإجمالي:</b> '+fmt(o.total)+'</p>'+((o.status==='picked_up'||o.status==='out_for_delivery')?'<div id="driver-gps-inline-'+o.id+'" class="driver-gps-inline">📍 GPS نشط</div>':'')+(action?'<button class="btn driver-action-btn" onclick="setStatus(\\''+o.id+'\\',\\''+action[0]+'\\')">'+action[1]+'</button>':'')+'</div>';}
function nextAction(role,status){if(role==='merchant')return ({pending:['accepted','قبول الطلب'],accepted:['preparing','بدء التجهيز'],preparing:['ready_for_pickup','جاهز للاستلام']}[status]||null);if(role==='driver')return ({driver_assigned:['picked_up','استلام الطلب'],picked_up:['out_for_delivery','بدء التوصيل'],out_for_delivery:['delivered','تأكيد التسليم']}[status]||null);return null;}
async function trackOrder(id){try{const d=await apiP('/orders/'+id+'/tracking'),t=d.tracking;let box=document.querySelector('#tracking-'+id);if(!box){box=document.createElement('div');box.id='tracking-'+id;box.className='card';box.style.marginTop='10px';document.querySelector('#orders').prepend(box)}if(!t.driver||t.driver.lat==null||t.driver.lng==null){box.innerHTML='<b>📍 تتبع المندوب</b><p class="muted">المندوب لم يرسل موقعه بعد.</p>';return}const lat=t.driver.lat,lng=t.driver.lng;box.innerHTML='<b>📍 المندوب: '+t.driver.name+'</b><p>الحالة: '+statusAr(t.status)+' · آخر تحديث: '+(t.driver.updatedAt||'-')+'</p><iframe title="خريطة المندوب" style="width:100%;height:260px;border:0;border-radius:12px" src="https://www.openstreetmap.org/export/embed.html?bbox='+(lng-0.01)+'%2C'+(lat-0.01)+'%2C'+(lng+0.01)+'%2C'+(lat+0.01)+'&layer=mapnik&marker='+lat+'%2C'+lng+'"></iframe>';}catch(e){alert(e.message)}}
async function loadOrders(){activeView='orders';const seq=++ordersLoadSeq;try{const d=await apiP('/orders?_='+Date.now());if(seq!==ordersLoadSeq)return;const box=document.querySelector('#orders'),role=currentRole();if(!role){box.innerHTML='<div class="card"><h3>⚠️ لم يتم تحديد صلاحية الحساب</h3><p class="muted">سجّل الدخول بالحساب الصحيح ثم أعد فتح الصفحة.</p></div>';return;}if(!ensurePageRole(role))return;if(role==='driver'){const view=localStorage.getItem('hesbahDriverView')==='history'?'history':'active';const driverOrders=d.orders.filter(o=>o.driverId);if(view==='history'){stopDriverGPS();const history=driverOrders.filter(o=>o.status==='delivered').sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));box.innerHTML=history.length?history.map(o=>'<div class="driver-task-card"><div class="driver-task-top"><span class="driver-task-icon">✅</span><div><b>طلب #'+(o.number||o.id)+'</b><small>تم التسليم</small></div></div><div class="driver-task-info"><span>👤 '+(o.customerName||o.customer?.name||'العميل')+'</span><span>💰 '+fmt(o.total)+'</span><span>🕒 '+new Date(o.updatedAt||o.createdAt||Date.now()).toLocaleString('ar-EG')+'</span></div></div>').join(''):'<div class="card"><p>لا توجد طلبات مكتملة في سجل التسليمات.</p></div>';return;}d.orders=driverOrders.filter(o=>['driver_assigned','picked_up','out_for_delivery'].includes(o.status));if(!d.orders.some(o=>['picked_up','out_for_delivery'].includes(o.status)))stopDriverGPS();else startDriverGPS();const active=d.orders;box.innerHTML=active.length?active.map(o=>driverTaskCard(o)).join(''):'<div class="card"><p>لا توجد طلبات مسندة إليك حالياً.</p></div>';return;}if(role==='merchant'){const counts={all:d.orders.length,pending:d.orders.filter(o=>o.status==='pending').length,active:d.orders.filter(o=>['accepted','preparing','ready_for_pickup','driver_assigned','picked_up','out_for_delivery'].includes(o.status)).length,done:d.orders.filter(o=>o.status==='delivered').length};const stat=document.querySelector('#merchantStats');if(stat)stat.innerHTML=[['كل الطلبات',counts.all,'📦'],['طلبات جديدة',counts.pending,'🔔'],['قيد التنفيذ',counts.active,'⚙️'],['تم التسليم',counts.done,'✅']].map(x=>'<div class="merchant-stat"><span>'+x[2]+'</span><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');const filter=document.querySelector('#merchantFilter');const active=filter?.dataset.status||'all';const visible=active==='all'?d.orders:active==='pending'?d.orders.filter(o=>o.status==='pending'):active==='active'?d.orders.filter(o=>['accepted','preparing','ready_for_pickup','driver_assigned','picked_up','out_for_delivery'].includes(o.status)):d.orders.filter(o=>o.status==='delivered');d.orders=visible}box.innerHTML=d.orders.length?d.orders.map(o=>{const action=nextAction(role,o.status);return '<div class="card"><div class="row"><h3>طلب #'+o.number+'</h3><span class="status">'+statusAr(o.status)+'</span></div><p class="muted">👤 عرض حسب صلاحية: <b>'+roleAr(role)+'</b></p>'+stageBar(o.status,role)+'<p><b>الخطوة الحالية:</b> '+statusAr(o.status)+'</p>'+(action?'<p class="muted">الإجراء المطلوب الآن: '+action[1]+'</p>':'')+'<p>الإجمالي: <b>'+fmt(o.total)+'</b>'+(role==='admin'?' · العمولة: '+fmt(o.commission)+' ('+o.commissionRate+'%)':'')+'</p><p class="muted">'+(o.address||'بدون عنوان')+'</p><div class="row">'+(role==='merchant'&&o.status==='pending'?'<button class="btn" onclick="setStatus(\\''+o.id+'\\',\\'accepted\\')">قبول الطلب</button><button class="btn light" onclick="setStatus(\\''+o.id+'\\',\\'cancelled\\')">رفض الطلب</button>':action?'<button class="btn" onclick="setStatus(\\''+o.id+'\\',\\''+action[0]+'\\')">'+action[1]+'</button>':'')+(role==='merchant'&&o.status==='ready_for_pickup'?'<button class="btn alt" onclick="assignDriver(\\''+o.id+'\\')">اختيار مندوب</button>':'')+(role!=='driver'&&o.driverId?'<button class="btn light" onclick="trackOrder(\\''+o.id+'\\')">📍 متابعة المندوب</button>':'')+'</div></div>'}).join(''):'<div class="card"><p>لا توجد طلبات في هذا التصنيف.</p></div>';for(const o of d.orders){if(o.driverId&&['driver_assigned','picked_up','out_for_delivery'].includes(o.status)&&role!=='driver')trackOrder(o.id)}}catch(e){alert(e.message)}}
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
async function assignDriver(id){try{const d=await apiP('/drivers');const free=d.drivers.filter(x=>x.status==='available');if(!free.length)return alert('لا يوجد مندوب متاح حالياً');const names=free.map((x,i)=>`${i+1}) ${x.name} — ${x.status} — ⭐${x.rating}`).join('\n');const pick=Number(prompt('اختر رقم المندوب:\n'+names));if(!pick||!free[pick-1])return;await apiP('/orders/'+id+'/assign-driver',{method:'POST',body:JSON.stringify({driverId:free[pick-1].id})});loadOrders()}catch(e){alert(e.message)}}
async function loadDashboard(){
 activeView='dashboard';
 try{const d=await apiP('/dashboard');document.querySelector('#kpis').innerHTML=Object.entries({الطلبات:d.stats.orders,'قيد التنفيذ':d.stats.pending,'المبيعات':fmt(d.stats.revenue),'عمولات Hesbah':fmt(d.stats.commissions),'صافي التجار':fmt(d.stats.merchantNet)}).map(([k,v])=>`<div class="card kpi"><span class="muted">${k}</span><strong>${v}</strong></div>`).join('');document.querySelector('#orders').innerHTML='<div class="card"><h2>مركز التحكم</h2><p class="muted">اختر قسمًا من القائمة لعرض تفاصيله.</p></div>'}catch(e){alert(e.message)}
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
async function loadDrivers(){activeView='drivers';try{const d=await apiP('/drivers');document.querySelector('#orders').innerHTML=d.drivers.map(x=>`<div class="card"><h3>${x.name}</h3><p>⭐ ${x.rating} · ${x.deliveries||0} توصيل</p><p>الحالة: <span class="status">${x.status}</span></p><p>GPS: ${x.lat??'-'}, ${x.lng??'-'}</p></div>`).join('')}catch(e){alert(e.message)}}
async function loadMerchantStore(){activeView='store';try{const u=JSON.parse(localStorage.hesbahUser||'{}'),d=await apiP('/stores/'+u.storeId);if(!d.ok)throw new Error(d.message||'تعذر تحميل المتجر');const s=d.store,esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');document.querySelector('#orders').innerHTML='<div class="merchant-editor card"><div class="row"><div><h2>🏪 بيانات المتجر</h2><p class="muted">حدّث بيانات متجرك ومعلومات التوصيل وحالة استقبال الطلبات.</p></div><span class="status '+(s.isOpen?'':'danger')+'">'+(s.isOpen?'🟢 مفتوح ويستقبل الطلبات':'🔴 مغلق مؤقتًا')+'</span></div><div class="merchant-form-grid"><label>اسم المتجر<input id="ms-name" class="input" value="'+esc(s.name)+'"></label><label>التصنيف<input id="ms-category" class="input" value="'+esc(s.category)+'"></label><label>رسوم التوصيل<input id="ms-fee" class="input" type="number" min="0" value="'+Number(s.deliveryFee||0)+'"></label><label>خط العرض<input id="ms-lat" class="input" type="number" step="any" value="'+(s.lat??'')+'"></label><label>خط الطول<input id="ms-lng" class="input" type="number" step="any" value="'+(s.lng??'')+'"></label><label style="grid-column:1/-1">وصف المتجر<textarea id="ms-desc" class="input">'+esc(s.description)+'</textarea></label></div><label class="merchant-switch"><input id="ms-open" type="checkbox" '+(s.isOpen?'checked':'')+'> استقبال الطلبات متاح</label><button class="btn" onclick="saveMerchantStore()">حفظ بيانات المتجر</button></div>'}catch(e){alert(e.message)}}async function saveMerchantStore(){try{const u=JSON.parse(localStorage.hesbahUser||'{}');await apiP('/stores/'+u.storeId,{method:'PATCH',body:JSON.stringify({name:document.querySelector('#ms-name').value.trim(),category:document.querySelector('#ms-category').value.trim(),description:document.querySelector('#ms-desc').value.trim(),deliveryFee:Number(document.querySelector('#ms-fee').value||0),lat:Number(document.querySelector('#ms-lat').value||0)||null,lng:Number(document.querySelector('#ms-lng').value||0)||null,isOpen:document.querySelector('#ms-open').checked})});alert('تم حفظ بيانات المتجر');loadMerchantStore()}catch(e){alert(e.message)}}async function loadMerchantProducts(){activeView='products';try{const d=await apiP('/products/manage');const rows=d.products||[];document.querySelector('#orders').innerHTML='<div class="merchant-products-head"><div><h2>🛍️ منتجات المتجر</h2><p class="muted">إضافة المنتجات وتعديل السعر والمخزون والتوفر.</p></div><button class="btn" onclick="addMerchantProduct()">+ إضافة منتج</button></div><div class="merchant-products-grid">'+(rows.length?rows.map(p=>'<div class="merchant-product-card"><div class="row"><strong>'+p.name+'</strong><span class="status '+(!p.available?'danger':'')+'">'+(p.available?'متاح':'موقوف')+'</span></div><p class="muted">'+(p.description||'بدون وصف')+'</p><div class="merchant-product-price">'+fmt(p.price)+'</div><small>المخزون: '+(Number(p.stock)<0?'غير محدود':p.stock)+' · '+(p.category||'عام')+'</small><div class="row" style="margin-top:12px"><button class="btn light" onclick="editMerchantProduct('+JSON.stringify(p.id)+')">تعديل</button><button class="btn '+(p.available?'alt':'')+'" onclick="toggleMerchantProduct('+JSON.stringify(p.id)+','+(!p.available)+')">'+(p.available?'إيقاف':'تفعيل')+'</button></div></div>').join(''):'<div class="card">لا توجد منتجات.</div>')+'</div>'}catch(e){alert(e.message)}}async function addMerchantProduct(){const name=prompt('اسم المنتج:');if(!name)return;const price=Number(prompt('السعر:','0'));if(!price||price<=0)return alert('السعر غير صحيح');const category=prompt('التصنيف:','عام')||'عام';try{await apiP('/products',{method:'POST',body:JSON.stringify({name,price,category,available:true,stock:-1})});loadMerchantProducts()}catch(e){alert(e.message)}}async function editMerchantProduct(id){try{const d=await apiP('/products/manage'),p=d.products.find(x=>x.id===id);if(!p)return;const name=prompt('اسم المنتج:',p.name);if(!name)return;const price=Number(prompt('السعر:',p.price));if(!price||price<=0)return alert('السعر غير صحيح');const stock=Number(prompt('المخزون (-1 = غير محدود):',p.stock));const description=prompt('الوصف:',p.description||'')??p.description;await apiP('/products/'+id,{method:'PATCH',body:JSON.stringify({name,price,stock,description})});loadMerchantProducts()}catch(e){alert(e.message)}}async function toggleMerchantProduct(id,available){try{await apiP('/products/'+id,{method:'PATCH',body:JSON.stringify({available})});loadMerchantProducts()}catch(e){alert(e.message)}}async function loadFinance(){activeView='finance';try{const d=await apiP('/finance'),s=d.summary||{},sett=d.settlements||[];document.querySelector('#orders').innerHTML='<div class="merchant-finance"><div class="merchant-finance-head"><div><h2>💰 الحساب المالي</h2><p class="muted">ملخص مستحقات متجرك وحركة التسويات.</p></div><span class="status">عدد الطلبات المسلّمة: '+Number(s.orders||0)+'</span></div><div class="merchant-finance-grid"><div class="card"><h3>صافي المبيعات</h3><strong>'+fmt(s.subtotal||0)+'</strong></div><div class="card"><h3>التوصيل</h3><strong>'+fmt(s.delivery||0)+'</strong></div><div class="card"><h3>صافي المستحق</h3><strong>'+fmt(s.merchantNet||0)+'</strong></div></div><div class="card merchant-settlements"><h3>التسويات المالية</h3>'+(sett.length?sett.map(x=>'<div class="row"><span>'+String(x.id||'تسوية')+'</span><strong>'+fmt(x.amount||x.total||0)+'</strong></div>').join(''):'<p class="muted">لا توجد تسويات مسجلة حتى الآن.</p>')+'</div></div>'}catch(e){alert(e.message)}}function renderRoleLogin(expected){
  const label=expected==='merchant'?'التاجر':expected==='admin'?'مدير النظام':'مستخدم';
  const icon=expected==='merchant'?'🏪':'🔐';
  document.body.innerHTML='<main class="driver-login-page"><section class="driver-login-card"><div class="driver-login-brand">HESBAH <span>'+expected.toUpperCase()+'</span></div><div class="driver-login-bike">'+icon+'</div><h1>تسجيل دخول '+label+'</h1><p>أدخل بيانات الحساب للوصول إلى لوحة التحكم.</p><form id="roleLoginForm"><input id="roleLoginUser" class="input" placeholder="اسم المستخدم" autocomplete="username" required><input id="roleLoginPass" class="input" type="password" placeholder="كلمة المرور" autocomplete="current-password" required><button class="btn" type="submit">دخول إلى لوحة التحكم</button></form><div id="roleLoginError" class="driver-login-error"></div></section></main>';
  document.querySelector('#roleLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();const err=document.querySelector('#roleLoginError');err.textContent='جاري تسجيل الدخول...';
    try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.querySelector('#roleLoginUser').value.trim(),password:document.querySelector('#roleLoginPass').value})});const d=await r.json();if(!r.ok)throw new Error(d.message||'بيانات الدخول غير صحيحة');if(d.user?.role!==expected)throw new Error('هذا الحساب ليس حساب '+label+'.');localStorage.hesbahToken=d.token;localStorage.hesbahUser=JSON.stringify(d.user);location.reload()}catch(e){err.textContent=e.message}
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
      localStorage.hesbahToken=d.token;
      localStorage.hesbahUser=JSON.stringify(d.user);
      location.reload();
    }catch(e){err.textContent=e.message}
  });
}
const path=location.pathname;
const expectedPageRole=pageRole();
if(expectedPageRole&&!token()&&expectedPageRole!=='driver')renderRoleLogin(expectedPageRole);
else if(path.endsWith('/driver.html')&&!token())renderDriverLogin();
else if(path.endsWith('/admin.html'))loadDashboard();else loadOrders();
setInterval(()=>{if(token()&&document.querySelector('#orders')&&activeView==='orders')loadOrders()},5000);
