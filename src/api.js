const express=require('express');
const {v4:uuid}=require('uuid');
const fs=require('fs');
const path=require('path');
const multer=require('multer');
const bcrypt=require('bcryptjs');
const {read,write}=require('./store');
const {requireAuth,allow}=require('./auth');
const router=express.Router();
const privateDocsDir=path.join(__dirname,'..','data','private','driver-docs');
fs.mkdirSync(privateDocsDir,{recursive:true});
const profileDir=path.join(__dirname,'..','data','private','customer-profiles');fs.mkdirSync(profileDir,{recursive:true});
const productImagesDir=path.join(__dirname,'..','data','product-images');fs.mkdirSync(productImagesDir,{recursive:true});
const productImageUpload=multer({
 storage:multer.diskStorage({
  destination:(_,__,cb)=>cb(null,productImagesDir),
  filename:(_,file,cb)=>cb(null,Date.now()+'-'+uuid()+path.extname(file.originalname).toLowerCase())
 }),
 limits:{fileSize:5*1024*1024},
 fileFilter:(_,file,cb)=>/^image\/(jpeg|png|webp)$/.test(file.mimetype)?cb(null,true):cb(new Error('الصورة يجب أن تكون JPG أو PNG أو WEBP'))
});
const profileUpload=multer({storage:multer.diskStorage({destination:(_,__,cb)=>cb(null,profileDir),filename:(_,file,cb)=>cb(null,Date.now()+'-'+uuid()+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:3*1024*1024},fileFilter:(_,file,cb)=>/^image\/(jpeg|png|webp)$/.test(file.mimetype)?cb(null,true):cb(new Error('الصورة يجب أن تكون JPG أو PNG أو WEBP'))});
const upload=multer({
 storage:multer.diskStorage({
  destination:(_,__,cb)=>cb(null,privateDocsDir),
  filename:(_,file,cb)=>cb(null,Date.now()+'-'+uuid()+path.extname(file.originalname).toLowerCase())
 }),
 limits:{fileSize:5*1024*1024},
 fileFilter:(_,file,cb)=>/^image\/(jpeg|png|webp)$/.test(file.mimetype)?cb(null,true):cb(new Error('الملف يجب أن يكون صورة JPG أو PNG أو WEBP'))
});
const money=n=>Math.round(Number(n||0)*100)/100;
const now=()=>new Date().toISOString();
const activeStatuses=['pending','accepted','preparing','ready_for_pickup','driver_assigned','picked_up','out_for_delivery'];
const transitions={
 pending:['accepted','cancelled'],accepted:['preparing','cancelled'],preparing:['ready_for_pickup','cancelled'],
 ready_for_pickup:['driver_assigned'],driver_assigned:['picked_up'],picked_up:['out_for_delivery'],out_for_delivery:['delivered'],delivered:[],cancelled:[]
};
function notify(db,userId,title,body){if(!userId)return;db.notifications.push({id:uuid(),userId,title,body,createdAt:now(),read:false});}
function user(db,id){return db.users.find(x=>x.id===id)}
function storeFor(db,id){return db.stores.find(x=>x.id===id)}
function driverFor(db,id){return db.drivers.find(x=>x.id===id)}
function publicStore(s){if(!s)return s;const {commission,...safe}=s;return safe;}
function visibleOrderData(req,o){
 const safe={...o};
 if(req.user.role!=='admin'){
  delete safe.commissionRate;
  delete safe.commission;
  delete safe.merchantNet;
 }
 return safe;
}
function addLedger(db,entry){db.ledger=db.ledger||[];db.ledger.push({id:uuid(),createdAt:now(),...entry});}
function visibleOrder(req,o){
 if(req.user.role==='admin')return true;
 if(req.user.role==='customer')return o.customerId===req.user.id;
 if(req.user.role==='merchant')return o.storeId===req.user.storeId;
 if(req.user.role==='driver')return o.driverId===req.user.driverId;
 return false;
}
router.get('/profile',requireAuth,allow('customer'),(req,res)=>{const db=read(),u=user(db,req.user.id);if(!u)return res.status(404).json({ok:false,message:'العميل غير موجود'});res.json({ok:true,profile:{id:u.id,name:u.name,phone:u.phone||'',email:u.email||'',username:u.username,address:u.address||'',lat:u.lat??null,lng:u.lng??null,whatsapp:u.social?.whatsapp||'',facebook:u.social?.facebook||'',instagram:u.social?.instagram||'',photo:u.photo?'/api/profile/photo':'',deleteRequestedAt:u.deleteRequestedAt||null}});});
router.patch('/profile',requireAuth,allow('customer'),(req,res)=>{const db=read(),u=user(db,req.user.id);if(!u)return res.status(404).json({ok:false,message:'العميل غير موجود'});for(const k of ['name','phone','address'])if(req.body[k]!==undefined)u[k]=String(req.body[k]||'').trim();if(req.body.lat!==undefined)u.lat=Number.isFinite(Number(req.body.lat))?Number(req.body.lat):null;if(req.body.lng!==undefined)u.lng=Number.isFinite(Number(req.body.lng))?Number(req.body.lng):null;u.social=u.social||{};for(const k of ['whatsapp','facebook','instagram'])if(req.body[k]!==undefined){const v=String(req.body[k]||'').trim();if(v&&!/^https?:\/\//i.test(v))return res.status(400).json({ok:false,message:'روابط التواصل يجب أن تبدأ بـ http أو https'});u.social[k]=v;}write(db);res.json({ok:true,message:'تم حفظ الملف الشخصي'});});
router.patch('/profile/password',requireAuth,allow('customer'),(req,res)=>{const db=read(),u=user(db,req.user.id),oldPassword=String(req.body.oldPassword||''),newPassword=String(req.body.newPassword||'');if(!u||!bcrypt.compareSync(oldPassword,u.password))return res.status(400).json({ok:false,message:'كلمة المرور الحالية غير صحيحة'});if(newPassword.length<6)return res.status(400).json({ok:false,message:'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'});u.password=bcrypt.hashSync(newPassword,10);u.sessionVersion=(u.sessionVersion||0)+1;write(db);res.json({ok:true,message:'تم تغيير كلمة المرور، سجل الدخول من جديد'});});
router.post('/profile/photo',requireAuth,allow('customer'),profileUpload.single('photo'),(req,res)=>{const db=read(),u=user(db,req.user.id);if(!u)return res.status(404).json({ok:false,message:'العميل غير موجود'});if(!req.file)return res.status(400).json({ok:false,message:'اختر صورة'});if(u.photo){const old=path.join(profileDir,path.basename(u.photo));if(fs.existsSync(old))fs.unlinkSync(old);}u.photo=req.file.filename;write(db);res.json({ok:true,photo:u.photo});});
router.get('/profile/photo',requireAuth,allow('customer'),(req,res)=>{const db=read(),u=user(db,req.user.id);if(!u||!u.photo)return res.status(404).json({ok:false,message:'لا توجد صورة'});const file=path.join(profileDir,path.basename(u.photo));if(!fs.existsSync(file))return res.status(404).json({ok:false,message:'الصورة غير موجودة'});res.sendFile(file);});
router.get('/marketplace',(req,res)=>{
 const db=read();const q=String(req.query.q||'').trim().toLowerCase();const cat=String(req.query.category||'').trim();
 let stores=db.stores.filter(s=>s.isOpen);
 if(cat)stores=stores.filter(s=>s.category===cat);
 if(q)stores=stores.filter(s=>(s.name+' '+s.description+' '+s.category).toLowerCase().includes(q));
 res.json({ok:true,stores:stores.map(publicStore),categories:[...new Set(db.stores.map(s=>s.category).filter(Boolean))],settings:{currency:db.settings.currency}});
});
router.get('/stores/:id',(req,res)=>{
 const db=read(),s=storeFor(db,req.params.id);if(!s)return res.status(404).json({ok:false,message:'المتجر غير موجود'});
 res.json({ok:true,store:publicStore(s),products:db.products.filter(p=>p.storeId===s.id)});
});
router.get('/products',(req,res)=>{
 const db=read();let p=db.products;
 if(req.query.storeId)p=p.filter(x=>x.storeId===req.query.storeId);
 if(req.query.q){const q=String(req.query.q).toLowerCase();p=p.filter(x=>(x.name+' '+x.description+' '+x.category).toLowerCase().includes(q))}
 if(req.query.available==='true')p=p.filter(x=>x.available&&x.stock!==0);
 res.json({ok:true,products:p});
});
router.get('/orders',requireAuth,(req,res)=>{
 const db=read();let o=db.orders.filter(x=>visibleOrder(req,x));
 if(req.query.status)o=o.filter(x=>x.status===req.query.status);
 res.json({ok:true,orders:o.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(o=>visibleOrderData(req,o))});
});
router.get('/orders/:id',requireAuth,(req,res)=>{
 const db=read(),o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({ok:false,message:'الطلب غير موجود'});
 if(!visibleOrder(req,o))return res.status(403).json({ok:false,message:'غير مصرح'});
 res.json({ok:true,order:visibleOrderData(req,o),driver:o.driverId?driverFor(db,o.driverId):null});
});
router.post('/orders',requireAuth,allow('customer'),(req,res)=>{
 try{
  const db=read(),{storeId,items,address,paymentMethod='cash',coupon,lat,lng}=req.body||{};
  if(!storeId||!Array.isArray(items)||!items.length||!address)return res.status(400).json({ok:false,message:'اختر المنتجات والعنوان'});
  const store=storeFor(db,storeId);if(!store||!store.isOpen)return res.status(400).json({ok:false,message:'المتجر مغلق حالياً'});const methods=db.settings.paymentMethods||[];if(!methods.some(x=>x.id===paymentMethod&&x.enabled))return res.status(400).json({ok:false,message:'طريقة الدفع غير متاحة حالياً'});
  let subtotal=0;
  const lines=items.map(i=>{
   const p=db.products.find(x=>x.id===i.productId&&x.storeId===storeId&&x.available);
   const qty=Math.max(1,Math.floor(Number(i.qty||1)));
   if(!p||p.stock===0||!p.available||Number(p.stock)>-1&&Number(p.stock)<qty)throw new Error('منتج غير متاح أو الكمية غير متوفرة');
   const total=money(p.price*qty);subtotal+=total;
   return {productId:p.id,name:p.name,price:p.price,qty,total};
  });
  let discount=0,couponId=null;
  if(coupon){
   const c=db.coupons.find(x=>x.code===String(coupon).toUpperCase()&&x.active&&(x.expiresAt?x.expiresAt>now():true));
   if(c&&(c.minOrder||0)<=subtotal){discount=c.type==='percent'?money(subtotal*c.value/100):Math.min(subtotal,Number(c.value));couponId=c.id;}
  }
  const commissionRate=Number(store.commission??db.settings.defaultCommission);
  const delivery=money(store.deliveryFee??db.settings.deliveryBase);
  const netSubtotal=money(subtotal-discount);
  const commission=money(netSubtotal*commissionRate/100);
  const merchantNet=money(netSubtotal-commission);
  const total=money(netSubtotal+delivery);
  const id='ord_'+uuid(),timestamp=now();
  const o={id,number:String(Date.now()).slice(-8),customerId:req.user.id,storeId,items:lines,address,lat:lat??null,lng:lng??null,paymentMethod,paymentStatus:paymentMethod==='cash'?'cash_on_delivery':'pending',couponId,subtotal,discount,delivery,total,commissionRate,commission,merchantNet,driverId:null,status:'pending',createdAt:timestamp,updatedAt:timestamp,timeline:[{status:'pending',at:timestamp}]};
  db.orders.push(o);
  for(const line of lines){const p=db.products.find(x=>x.id===line.productId);if(p.stock!=null&&p.stock>0)p.stock-=line.qty;}
  notify(db,req.user.id,'تم استلام طلبك','رقم الطلب '+o.number);
  notify(db,store.ownerUserId,'طلب جديد','لديك طلب جديد رقم '+o.number);
  addLedger(db,{type:'order',orderId:o.id,storeId,customerId:req.user.id,subtotal:netSubtotal,commission,merchantNet,delivery,driverEarning:delivery,paymentMethod:o.paymentMethod,paymentStatus:o.paymentStatus});
  write(db);res.status(201).json({ok:true,order:visibleOrderData(req,o)});
 }catch(e){res.status(400).json({ok:false,message:e.message||'تعذر إنشاء الطلب'});}
});
router.patch('/orders/:id/status',requireAuth,allow('admin','merchant','driver','customer'),(req,res)=>{
 const db=read(),o=db.orders.find(x=>x.id===req.params.id),next=String(req.body.status||'');
 if(!o)return res.status(404).json({ok:false,message:'الطلب غير موجود'});
 if(req.user.role==='merchant'&&o.storeId!==req.user.storeId)return res.status(403).json({ok:false,message:'غير مصرح'});
 if(req.user.role==='driver'&&o.driverId!==req.user.driverId)return res.status(403).json({ok:false,message:'الطلب ليس مسنداً إليك'});
 if(req.user.role==='customer'&&o.customerId!==req.user.id)return res.status(403).json({ok:false,message:'غير مصرح'});
 if(!(transitions[o.status]||[]).includes(next))return res.status(400).json({ok:false,message:'تغيير الحالة غير مسموح'});
 if(req.user.role==='customer'&&next!=='cancelled')return res.status(403).json({ok:false,message:'غير مصرح'});
 o.status=next;o.updatedAt=now();o.timeline.push({status:next,at:o.updatedAt,by:req.user.id});
 if(next==='delivered'&&o.driverId){const d=driverFor(db,o.driverId);if(d){d.status='available';d.deliveries=(d.deliveries||0)+1;}}
 if(next==='cancelled'&&o.driverId){const d=driverFor(db,o.driverId);if(d)d.status='available';}
 notify(db,o.customerId,'تحديث الطلب','طلبك '+o.number+' أصبح: '+next);
 write(db);res.json({ok:true,order:o});
});
router.post('/orders/:id/assign-driver',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read(),o=db.orders.find(x=>x.id===req.params.id),d=driverFor(db,req.body.driverId);
 if(!o||!d)return res.status(404).json({ok:false,message:'الطلب أو المندوب غير موجود'});
 if(req.user.role==='merchant'&&o.storeId!==req.user.storeId)return res.status(403).json({ok:false,message:'غير مصرح'});
 if(o.status!=='ready_for_pickup')return res.status(409).json({ok:false,message:'الطلب يجب أن يكون جاهزاً للاستلام أولاً'});if(d.status!=='available')return res.status(409).json({ok:false,message:'المندوب غير متاح حالياً'});
 if(o.driverId&&o.driverId!==d.id){const old=driverFor(db,o.driverId);if(old)old.status='available';}
 o.driverId=d.id;o.status='driver_assigned';o.updatedAt=now();o.timeline.push({status:o.status,at:o.updatedAt,by:req.user.id});
 d.status='busy';notify(db,d.userId,'مهمة توصيل جديدة','تم إسناد الطلب '+o.number+' إليك');notify(db,o.customerId,'تم تعيين المندوب','جارٍ تجهيز التوصيل');
 write(db);res.json({ok:true,order:visibleOrderData(req,o),driver:d});
});
router.get('/drivers/me',requireAuth,allow('driver'),(req,res)=>{const db=read(),d=driverFor(db,req.user.driverId);if(!d)return res.status(404).json({ok:false,message:'المندوب غير موجود'});res.json({ok:true,driver:{id:d.id,name:d.name,status:d.status||'available',deliveries:d.deliveries||0}});});
router.patch('/drivers/me/status',requireAuth,allow('driver'),(req,res)=>{const db=read(),d=driverFor(db,req.user.driverId),next=String(req.body.status||'');if(!d)return res.status(404).json({ok:false,message:'المندوب غير موجود'});if(!['available','unavailable'].includes(next))return res.status(400).json({ok:false,message:'حالة غير صالحة'});const busy=db.orders.some(o=>o.driverId===d.id&&['driver_assigned','picked_up','out_for_delivery'].includes(o.status));if(next==='unavailable'&&busy)return res.status(409).json({ok:false,message:'لا يمكن إيقاف التوفر أثناء وجود طلب توصيل نشط'});d.status=next;d.updatedAt=now();write(db);res.json({ok:true,status:d.status});});
router.get('/drivers',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read();const drivers=req.user.role==='admin'?db.drivers.map(d=>({...d,user:undefined})):db.drivers.map(d=>({id:d.id,name:d.name,phone:d.phone,status:d.status,rating:d.rating,lat:d.lat??null,lng:d.lng??null,updatedAt:d.updatedAt||null,deliveries:d.deliveries||0}));res.json({ok:true,drivers});
});

router.get('/orders/:id/tracking',requireAuth,(req,res)=>{const db=read(),o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({ok:false,message:'الطلب غير موجود'});if(!visibleOrder(req,o))return res.status(403).json({ok:false,message:'غير مصرح'});const d=o.driverId?driverFor(db,o.driverId):null;res.json({ok:true,tracking:{active:['picked_up','out_for_delivery'].includes(o.status),status:o.status,customerLocation:{lat:o.lat??null,lng:o.lng??null,address:o.address||''},driver:d?{id:d.id,name:d.name,lat:d.lat??null,lng:d.lng??null,updatedAt:d.updatedAt||null}:null}});});

router.patch('/drivers/me/location',requireAuth,allow('driver'),(req,res)=>{const db=read(),d=driverFor(db,req.user.driverId);if(!d)return res.status(404).json({ok:false,message:'المندوب غير موجود'});const o=db.orders.find(x=>x.driverId===d.id&&['picked_up','out_for_delivery'].includes(x.status));if(!o)return res.status(409).json({ok:false,message:'لا يوجد طلب توصيل نشط حالياً'});const lat=Number(req.body.lat),lng=Number(req.body.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return res.status(400).json({ok:false,message:'إحداثيات الموقع غير صحيحة'});d.lat=lat;d.lng=lng;d.updatedAt=now();write(db);res.json({ok:true,location:{lat,lng,updatedAt:d.updatedAt},orderId:o.id});});
router.patch('/drivers/me',requireAuth,allow('driver'),(req,res)=>{
 const db=read(),d=driverFor(db,req.user.driverId);if(!d)return res.status(404).json({ok:false});
 if(['available','offline'].includes(req.body.status)&&d.status!=='busy')d.status=req.body.status;
 if(Number.isFinite(Number(req.body.lat)))d.lat=Number(req.body.lat);
 if(Number.isFinite(Number(req.body.lng)))d.lng=Number(req.body.lng);
 d.updatedAt=now();write(db);res.json({ok:true,driver:d});
});
router.patch('/drivers/:id/location',requireAuth,allow('admin','driver'),(req,res)=>{
 const db=read(),d=driverFor(db,req.params.id);if(!d)return res.status(404).json({ok:false});
 if(req.user.role==='driver'&&d.id!==req.user.driverId)return res.status(403).json({ok:false});
 d.lat=Number(req.body.lat);d.lng=Number(req.body.lng);d.updatedAt=now();write(db);res.json({ok:true});
});
router.get('/dashboard',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),delivered=db.orders.filter(o=>o.status==='delivered');
 const revenue=money(delivered.reduce((a,o)=>a+o.subtotal-o.discount,0));
 const commissions=money(delivered.reduce((a,o)=>a+o.commission,0));
 const delivery=money(delivered.reduce((a,o)=>a+o.delivery,0));
 res.json({ok:true,stats:{orders:db.orders.length,pending:db.orders.filter(o=>activeStatuses.includes(o.status)).length,revenue,commissions,delivery,stores:db.stores.length,drivers:db.drivers.length,customers:db.users.filter(u=>u.role==='customer').length,merchantNet:money(delivered.reduce((a,o)=>a+o.merchantNet,0))}});
});
router.get('/finance',requireAuth,allow('admin','merchant','driver'),(req,res)=>{
 const db=read();let orders=db.orders.filter(o=>o.status==='delivered');
 if(req.user.role==='merchant')orders=orders.filter(o=>o.storeId===req.user.storeId);
 if(req.user.role==='driver')orders=orders.filter(o=>o.driverId===req.user.driverId);
 const subtotal=money(orders.reduce((a,o)=>a+o.subtotal-o.discount,0));
 const delivery=money(orders.reduce((a,o)=>a+o.delivery,0));
 const summary=req.user.role==='admin'
  ? {orders:orders.length,subtotal,commission:money(orders.reduce((a,o)=>a+o.commission,0)),delivery,merchantNet:money(orders.reduce((a,o)=>a+o.merchantNet,0))}
  : req.user.role==='merchant'
    ? {orders:orders.length,subtotal,delivery,merchantNet:money(orders.reduce((a,o)=>a+o.merchantNet,0))}
    : {orders:orders.length,delivery,earnings:delivery};
 res.json({ok:true,summary,settlements:db.settlements.filter(x=>req.user.role==='admin'||(req.user.role==='merchant'&&x.ownerId===req.user.storeId)||(req.user.role==='driver'&&x.ownerId===req.user.driverId))});
});
router.get('/settings',requireAuth,allow('admin'),(req,res)=>res.json({ok:true,settings:read().settings}));
router.get('/payment-methods',(req,res)=>res.json({ok:true,paymentMethods:(read().settings.paymentMethods||[]).filter(x=>x.enabled).map(({id,name,instructions})=>({id,name,instructions:instructions||''}))}));
router.patch('/settings',requireAuth,allow('admin'),(req,res)=>{
 const db=read();if(req.body.defaultCommission!=null)db.settings.defaultCommission=Math.max(0,Number(req.body.defaultCommission));
 if(req.body.deliveryBase!=null)db.settings.deliveryBase=Math.max(0,Number(req.body.deliveryBase));
 if(req.body.currency)db.settings.currency=String(req.body.currency);if(Array.isArray(req.body.paymentMethods))db.settings.paymentMethods=req.body.paymentMethods.map(x=>({id:String(x.id),name:String(x.name),enabled:Boolean(x.enabled),instructions:String(x.instructions||'').trim()}));
 write(db);res.json({ok:true,settings:db.settings});
});
router.get('/stores',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read();let stores=db.stores;if(req.user.role==='merchant')stores=stores.filter(s=>s.id===req.user.storeId).map(publicStore);res.json({ok:true,stores});
});
router.patch('/stores/:id',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read(),s=storeFor(db,req.params.id);if(!s)return res.status(404).json({ok:false,message:'المتجر غير موجود'});
 if(req.user.role==='merchant'&&s.id!==req.user.storeId)return res.status(403).json({ok:false});
 for(const k of ['name','category','description','deliveryFee','lat','lng','isOpen'])if(req.body[k]!==undefined)s[k]=req.body[k];if(req.user.role==='admin'&&req.body.commission!==undefined)s.commission=Math.max(0,Number(req.body.commission));
 s.updatedAt=now();write(db);res.json({ok:true,store:s});
});
router.post('/stores',requireAuth,allow('admin'),(req,res)=>{
 try{
  const db=read(),b=req.body||{};
  const name=String(b.name||'').trim(),category=String(b.category||'عام').trim();
  const username=String(b.username||'').trim(),password=String(b.password||'');
  if(!name)return res.status(400).json({ok:false,message:'اسم المتجر مطلوب'});
  if(username&&username.length<4)return res.status(400).json({ok:false,message:'اسم مستخدم صاحب المتجر يجب أن يكون 4 أحرف على الأقل'});
  if(username&&password.length<6)return res.status(400).json({ok:false,message:'كلمة المرور يجب أن تكون 6 أحرف على الأقل'});
  if(username&&db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return res.status(409).json({ok:false,message:'اسم المستخدم مستخدم بالفعل'});
  const storeId='s_'+uuid(),userId=username?'u_'+uuid():null;
  const s={id:storeId,name,category,description:String(b.description||'').trim(),rating:5,
   commission:b.commission!=null?Math.max(0,Number(b.commission)):db.settings.defaultCommission,
   deliveryFee:b.deliveryFee!=null?Math.max(0,Number(b.deliveryFee)):db.settings.deliveryBase,
   isOpen:b.isOpen!==false,lat:b.lat===''||b.lat==null?null:Number(b.lat),lng:b.lng===''||b.lng==null?null:Number(b.lng),
   ownerUserId:userId};
  db.stores.push(s);
  if(username){
   const u={id:userId,name:String(b.ownerName||name).trim(),phone:String(b.phone||'').trim(),email:String(b.email||'').trim().toLowerCase(),
    username,password:bcrypt.hashSync(password,10),role:'merchant',storeId,createdAt:now()};
   db.users.push(u);
  }
  write(db);
  res.status(201).json({ok:true,store:s,owner:userId?{id:userId,name:String(b.ownerName||name).trim(),username,role:'merchant',storeId}:null});
 }catch(e){res.status(400).json({ok:false,message:e.message||'تعذر إنشاء المتجر'});}
});
router.post('/products/image',requireAuth,allow('admin','merchant'),productImageUpload.single('image'),(req,res)=>{
 if(!req.file)return res.status(400).json({ok:false,message:'اختر صورة'});
 res.json({ok:true,image:'/api/products/image/'+encodeURIComponent(req.file.filename)});
});
router.get('/products/image/:name',(req,res)=>{
 const file=path.join(productImagesDir,path.basename(req.params.name));
 if(!fs.existsSync(file))return res.status(404).json({ok:false,message:'الصورة غير موجودة'});
 res.sendFile(file);
});
router.get('/products/manage',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read();let p=db.products;if(req.user.role==='merchant')p=p.filter(x=>x.storeId===req.user.storeId);res.json({ok:true,products:p});
});
router.post('/products',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read(),storeId=req.user.role==='merchant'?req.user.storeId:req.body.storeId;if(!storeId)return res.status(400).json({ok:false,message:'حدد المتجر'});
 const p={id:'p_'+uuid(),storeId,name:String(req.body.name||''),description:String(req.body.description||''),price:Number(req.body.price||0),oldPrice:Number(req.body.oldPrice||0),image:String(req.body.image||''),available:req.body.available!==false,stock:req.body.stock==null?-1:Number(req.body.stock),category:String(req.body.category||'عام')};
 if(!p.name||p.price<=0)return res.status(400).json({ok:false,message:'بيانات المنتج غير صحيحة'});db.products.push(p);write(db);res.status(201).json({ok:true,product:p});
});
router.patch('/products/:id',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read(),p=db.products.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false});
 if(req.user.role==='merchant'&&p.storeId!==req.user.storeId)return res.status(403).json({ok:false});
 for(const k of ['name','description','price','oldPrice','image','available','stock','category'])if(req.body[k]!==undefined)p[k]=req.body[k];
 write(db);res.json({ok:true,product:p});
});
router.delete('/products/:id',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read(),p=db.products.find(x=>x.id===req.params.id);
 if(!p)return res.status(404).json({ok:false,message:'المنتج غير موجود'});
 if(req.user.role==='merchant'&&p.storeId!==req.user.storeId)return res.status(403).json({ok:false,message:'غير مصرح'});
 if(p.image&&p.image.includes('/api/products/image/')){
  const file=path.join(productImagesDir,path.basename(decodeURIComponent(p.image.split('/').pop())));
  if(fs.existsSync(file))fs.unlinkSync(file);
 }
 db.products=db.products.filter(x=>x.id!==p.id);write(db);res.json({ok:true});
});
router.get('/coupons',requireAuth,allow('admin'),(req,res)=>res.json({ok:true,coupons:read().coupons}));
router.post('/coupons',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),c={id:'c_'+uuid(),code:String(req.body.code||'').toUpperCase(),type:req.body.type==='fixed'?'fixed':'percent',value:Number(req.body.value||0),minOrder:Number(req.body.minOrder||0),active:req.body.active!==false,expiresAt:req.body.expiresAt||null};
 if(!c.code||c.value<=0)return res.status(400).json({ok:false,message:'بيانات الكوبون غير صحيحة'});db.coupons.push(c);write(db);res.status(201).json({ok:true,coupon:c});
});
router.post('/ratings',requireAuth,allow('customer'),(req,res)=>{
 const db=read(),o=db.orders.find(x=>x.id===req.body.orderId&&x.customerId===req.user.id&&x.status==='delivered');if(!o)return res.status(400).json({ok:false,message:'يمكن التقييم بعد التسليم'});
 const value=Math.min(5,Math.max(1,Number(req.body.value||0)));db.ratings.push({id:uuid(),orderId:o.id,customerId:req.user.id,storeId:o.storeId,driverId:o.driverId||null,value,comment:String(req.body.comment||''),createdAt:now()});write(db);res.status(201).json({ok:true});
});
router.get('/notifications',requireAuth,(req,res)=>{const db=read();res.json({ok:true,notifications:db.notifications.filter(n=>n.userId===req.user.id).slice(-100).reverse()})});
router.patch('/notifications/:id/read',requireAuth,(req,res)=>{const db=read(),n=db.notifications.find(x=>x.id===req.params.id&&x.userId===req.user.id);if(!n)return res.status(404).json({ok:false});n.read=true;write(db);res.json({ok:true})});


// تسجيل المندوب: الطلب يظل قيد المراجعة حتى يعتمد من الإدارة.
router.post('/driver-applications',
 upload.fields([
  {name:'selfie',maxCount:1},{name:'idFront',maxCount:1},{name:'idBack',maxCount:1},
  {name:'drivingLicense',maxCount:1},{name:'vehicleLicense',maxCount:1}
 ]),
 (req,res)=>{
  try{
   const db=read(),b=req.body||{},files=req.files||{};
   const required=['name','phone','nationalId','address','vehicleType','vehicleBrand','vehicleModel','vehiclePlate','consent'];
   if(required.some(k=>!String(b[k]||'').trim())||String(b.consent)!=='yes')return res.status(400).json({ok:false,message:'أكمل بيانات التحقق والموافقة المطلوبة'});
   if(String(b.nationalId).trim().length<10)return res.status(400).json({ok:false,message:'رقم البطاقة غير صحيح'});
   for(const key of ['selfie','idFront','idBack','drivingLicense','vehicleLicense'])if(!files[key]?.[0])return res.status(400).json({ok:false,message:'كل صور التحقق مطلوبة'});
   if(db.driverApplications?.some(x=>x.nationalId===String(b.nationalId).trim()&&['pending','approved'].includes(x.status)))return res.status(409).json({ok:false,message:'يوجد طلب تسجيل قائم بهذا الرقم'});
   db.driverApplications=db.driverApplications||[];
   const id='da_'+uuid(),createdAt=now();
   const app={id,name:String(b.name).trim(),phone:String(b.phone).trim(),nationalId:String(b.nationalId).trim(),address:String(b.address).trim(),
    vehicleType:String(b.vehicleType).trim(),vehicleBrand:String(b.vehicleBrand).trim(),vehicleModel:String(b.vehicleModel).trim(),vehiclePlate:String(b.vehiclePlate).trim(),
    notes:String(b.notes||'').trim(),status:'pending',createdAt,updatedAt:createdAt,
    consentAt:createdAt,consentVersion:'driver-verification-v1',ip:req.ip||'',userAgent:req.get('user-agent')||'',
    documents:Object.fromEntries(['selfie','idFront','idBack','drivingLicense','vehicleLicense'].map(k=>[k,{filename:files[k][0].filename,originalName:files[k][0].originalname,mime:files[k][0].mimetype,size:files[k][0].size}])),
    userId:null,driverId:null};
   db.driverApplications.push(app);write(db);
   res.status(201).json({ok:true,applicationId:id,status:'pending',message:'تم إرسال طلبك وسيتم مراجعته قبل تفعيل الحساب'});
  }catch(e){res.status(400).json({ok:false,message:e.message||'تعذر إرسال الطلب'});}
 });
router.get('/driver-applications',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),apps=(db.driverApplications||[]).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 res.json({ok:true,applications:apps.map(x=>({...x,documents:Object.fromEntries(Object.entries(x.documents||{}).map(([k,v])=>[k,{name:v.originalName,size:v.size}]))}))});
});
router.get('/driver-applications/:id/document/:type',requireAuth,allow('admin'),(req,res)=>{
 const allowedDocs=['selfie','idFront','idBack','drivingLicense','vehicleLicense'];if(!allowedDocs.includes(req.params.type))return res.status(400).json({ok:false,message:'نوع المستند غير صحيح'});const db=read(),app=(db.driverApplications||[]).find(x=>x.id===req.params.id),doc=app?.documents?.[req.params.type];
 if(!doc)return res.status(404).json({ok:false,message:'المستند غير موجود'});
 const file=path.join(privateDocsDir,path.basename(doc.filename));
 if(!fs.existsSync(file))return res.status(404).json({ok:false,message:'ملف المستند غير موجود'});
 res.setHeader('Content-Disposition','inline; filename="'+String(doc.originalName).replace(/["\\]/g,'')+'"');res.sendFile(file);
});
router.patch('/driver-applications/:id',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),app=(db.driverApplications||[]).find(x=>x.id===req.params.id),next=String(req.body.status||'');
 if(!app)return res.status(404).json({ok:false,message:'طلب التسجيل غير موجود'});
 if(!['pending','approved','rejected'].includes(next))return res.status(400).json({ok:false,message:'حالة غير صحيحة'});
 if(app.status==='approved'&&next!=='approved')return res.status(400).json({ok:false,message:'لا يمكن إلغاء اعتماد طلب مفعل'});
 if(next==='approved'&&app.status!=='approved'){
  const username=String(req.body.username||'').trim(),password=String(req.body.password||'');
  if(username.length<4||password.length<6)return res.status(400).json({ok:false,message:'عند الاعتماد أدخل اسم مستخدم وكلمة مرور صالحين'});
  if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase()))return res.status(409).json({ok:false,message:'اسم المستخدم مستخدم بالفعل'});
  const userId='u_'+uuid(),driverId='d_'+uuid();
  const u={id:userId,name:app.name,phone:app.phone,username,password:require('bcryptjs').hashSync(password,10),role:'driver',driverId,createdAt:now()};
  const d={id:driverId,userId,name:app.name,phone:app.phone,status:'offline',rating:5,lat:null,lng:null,deliveries:0,nationalId:app.nationalId,vehicleType:app.vehicleType,vehicleBrand:app.vehicleBrand,vehicleModel:app.vehicleModel,vehiclePlate:app.vehiclePlate};
  db.users.push(u);db.drivers.push(d);app.userId=userId;app.driverId=driverId;
 }
 app.status=next;app.reviewedAt=now();app.reviewedBy=req.user.id;app.updatedAt=app.reviewedAt;app.reviewNote=String(req.body.note||'');
 write(db);res.json({ok:true,application:{id:app.id,status:app.status,userId:app.userId,driverId:app.driverId}});
});

router.get('/users',requireAuth,allow('admin'),(req,res)=>{const db=read();res.json({ok:true,users:db.users.map(u=>({id:u.id,name:u.name,phone:u.phone,username:u.username,role:u.role,storeId:u.storeId,driverId:u.driverId,createdAt:u.createdAt,lastLoginAt:u.lastLoginAt,lastLoginIp:u.lastLoginIp}))});});
router.post('/users/:id/delete-request',requireAuth,(req,res)=>{const db=read(),u=user(db,req.params.id);if(!u)return res.status(404).json({ok:false,message:'المستخدم غير موجود'});if(req.user.id!==u.id&&req.user.role!=='admin')return res.status(403).json({ok:false,message:'غير مصرح'});if(u.role!=='customer')return res.status(400).json({ok:false,message:'حذف هذا النوع من الحسابات يحتاج إجراء إداري خاص'});if(u.deleteRequestedAt)return res.status(409).json({ok:false,message:'يوجد طلب حذف قائم بالفعل'});u.deleteRequestedAt=now();u.deleteRequestNote=String(req.body.note||'').trim();write(db);res.json({ok:true,message:'تم إرسال طلب حذف الحساب للإدارة'});});
router.get('/customer-delete-requests',requireAuth,allow('admin'),(req,res)=>{const db=read();res.json({ok:true,requests:db.users.filter(u=>u.role==='customer'&&u.deleteRequestedAt).map(u=>({id:u.id,name:u.name,phone:u.phone,email:u.email||'',username:u.username,requestedAt:u.deleteRequestedAt,note:u.deleteRequestNote||''}))});});
router.patch('/customer-delete-requests/:id',requireAuth,allow('admin'),(req,res)=>{const db=read(),u=user(db,req.params.id),action=String(req.body.action||'');if(!u||u.role!=='customer'||!u.deleteRequestedAt)return res.status(404).json({ok:false,message:'طلب الحذف غير موجود'});if(action==='reject'){u.deleteRequestedAt=null;u.deleteRequestNote='';write(db);return res.json({ok:true,message:'تم رفض طلب الحذف'});}if(action==='approve'){const hasActive=(db.orders||[]).some(o=>o.customerId===u.id&&!['delivered','cancelled'].includes(o.status));if(hasActive)return res.status(409).json({ok:false,message:'لا يمكن حذف العميل لديه طلبات نشطة'});if(u.photo){const file=path.join(profileDir,path.basename(u.photo));if(fs.existsSync(file))fs.unlinkSync(file);}db.notifications=(db.notifications||[]).filter(n=>n.userId!==u.id);db.users=db.users.filter(x=>x.id!==u.id);write(db);return res.json({ok:true,message:'تم حذف حساب العميل بعد موافقة الإدارة'});}return res.status(400).json({ok:false,message:'إجراء غير صحيح'});});
router.post('/users',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),{name,phone,email,username,password,role,storeId}=req.body||{};
 if(!name||!username||!password||!['admin','merchant','driver','customer'].includes(role))return res.status(400).json({ok:false,message:'بيانات المستخدم غير صحيحة'});
 if(db.users.some(u=>u.username.toLowerCase()===String(username).toLowerCase()))return res.status(409).json({ok:false,message:'اسم المستخدم مستخدم بالفعل'});
 const u={id:'u_'+uuid(),name:String(name),phone:String(phone||''),email:String(email||'').trim().toLowerCase(),username:String(username),password:require('bcryptjs').hashSync(String(password),10),role,storeId:storeId||undefined,createdAt:now()};
 if(role==='driver'){const d={id:'d_'+uuid(),userId:u.id,name:u.name,phone:u.phone,status:'offline',rating:5,lat:null,lng:null,deliveries:0};db.drivers.push(d);u.driverId=d.id;}
 db.users.push(u);write(db);res.status(201).json({ok:true,user:{id:u.id,name:u.name,phone:u.phone,username:u.username,role:u.role,storeId:u.storeId,driverId:u.driverId}});
});
router.patch('/users/:id',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),u=user(db,req.params.id);if(!u)return res.status(404).json({ok:false,message:'المستخدم غير موجود'});
 for(const k of ['name','phone','role','storeId'])if(req.body[k]!==undefined)u[k]=req.body[k];
 if(req.body.password)u.password=require('bcryptjs').hashSync(String(req.body.password),10);
 write(db);res.json({ok:true});
});
router.post('/settlements',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),{ownerType,ownerId}=req.body||{};if(!['merchant','driver'].includes(ownerType)||!ownerId)return res.status(400).json({ok:false,message:'بيانات التسوية غير صحيحة'});
 const orders=db.orders.filter(o=>o.status==='delivered'&&(ownerType==='merchant'?o.storeId===ownerId:o.driverId===ownerId));
 const amount=money(ownerType==='merchant'?orders.reduce((a,o)=>a+o.merchantNet,0):orders.reduce((a,o)=>a+o.delivery,0));
 const s={id:'set_'+uuid(),ownerType,ownerId,orderIds:orders.map(o=>o.id),amount,status:'pending',createdAt:now()};db.settlements.push(s);write(db);res.status(201).json({ok:true,settlement:s});
});
module.exports=router;