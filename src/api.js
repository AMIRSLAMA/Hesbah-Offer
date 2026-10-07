const express=require('express');
const {v4:uuid}=require('uuid');
const {read,write}=require('./store');
const {requireAuth,allow}=require('./auth');
const router=express.Router();
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
function addLedger(db,entry){db.ledger=db.ledger||[];db.ledger.push({id:uuid(),createdAt:now(),...entry});}
function visibleOrder(req,o){
 if(req.user.role==='admin')return true;
 if(req.user.role==='customer')return o.customerId===req.user.id;
 if(req.user.role==='merchant')return o.storeId===req.user.storeId;
 if(req.user.role==='driver')return o.driverId===req.user.driverId;
 return false;
}
router.get('/marketplace',(req,res)=>{
 const db=read();const q=String(req.query.q||'').trim().toLowerCase();const cat=String(req.query.category||'').trim();
 let stores=db.stores.filter(s=>s.isOpen);
 if(cat)stores=stores.filter(s=>s.category===cat);
 if(q)stores=stores.filter(s=>(s.name+' '+s.description+' '+s.category).toLowerCase().includes(q));
 res.json({ok:true,stores,categories:[...new Set(db.stores.map(s=>s.category).filter(Boolean))],settings:{currency:db.settings.currency}});
});
router.get('/stores/:id',(req,res)=>{
 const db=read(),s=storeFor(db,req.params.id);if(!s)return res.status(404).json({ok:false,message:'المتجر غير موجود'});
 res.json({ok:true,store:s,products:db.products.filter(p=>p.storeId===s.id)});
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
 res.json({ok:true,orders:o.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
});
router.get('/orders/:id',requireAuth,(req,res)=>{
 const db=read(),o=db.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({ok:false,message:'الطلب غير موجود'});
 if(!visibleOrder(req,o))return res.status(403).json({ok:false,message:'غير مصرح'});
 res.json({ok:true,order:o,driver:o.driverId?driverFor(db,o.driverId):null});
});
router.post('/orders',requireAuth,allow('customer'),(req,res)=>{
 try{
  const db=read(),{storeId,items,address,paymentMethod='cash',coupon,lat,lng}=req.body||{};
  if(!storeId||!Array.isArray(items)||!items.length||!address)return res.status(400).json({ok:false,message:'اختر المنتجات والعنوان'});
  const store=storeFor(db,storeId);if(!store||!store.isOpen)return res.status(400).json({ok:false,message:'المتجر مغلق حالياً'});
  let subtotal=0;
  const lines=items.map(i=>{
   const p=db.products.find(x=>x.id===i.productId&&x.storeId===storeId&&x.available);
   const qty=Math.max(1,Math.floor(Number(i.qty||1)));
   if(!p||p.stock===0||Number(p.stock)<qty)throw new Error('منتج غير متاح أو الكمية غير متوفرة');
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
  const o={id,number:String(Date.now()).slice(-8),customerId:req.user.id,storeId,items:lines,address,lat:lat??null,lng:lng??null,paymentMethod,couponId,subtotal,discount,delivery,total,commissionRate,commission,merchantNet,driverId:null,status:'pending',createdAt:timestamp,updatedAt:timestamp,timeline:[{status:'pending',at:timestamp}]};
  db.orders.push(o);
  for(const line of lines){const p=db.products.find(x=>x.id===line.productId);if(p.stock!=null&&p.stock>0)p.stock-=line.qty;}
  notify(db,req.user.id,'تم استلام طلبك','رقم الطلب '+o.number);
  notify(db,store.ownerUserId,'طلب جديد','لديك طلب جديد رقم '+o.number);
  addLedger(db,{type:'order',orderId:o.id,storeId,customerId:req.user.id,subtotal:netSubtotal,commission,merchantNet,delivery,driverEarning:delivery});
  write(db);res.status(201).json({ok:true,order:o});
 }catch(e){res.status(400).json({ok:false,message:e.message||'تعذر إنشاء الطلب'});}
});
router.patch('/orders/:id/status',requireAuth,(req,res)=>{
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
 if(d.status==='busy')return res.status(409).json({ok:false,message:'المندوب مشغول حالياً'});
 if(o.driverId&&o.driverId!==d.id){const old=driverFor(db,o.driverId);if(old)old.status='available';}
 o.driverId=d.id;o.status='driver_assigned';o.updatedAt=now();o.timeline.push({status:o.status,at:o.updatedAt,by:req.user.id});
 d.status='busy';notify(db,d.userId,'مهمة توصيل جديدة','تم إسناد الطلب '+o.number+' إليك');notify(db,o.customerId,'تم تعيين المندوب','جارٍ تجهيز التوصيل');
 write(db);res.json({ok:true,order:o,driver:d});
});
router.get('/drivers',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read();res.json({ok:true,drivers:db.drivers.map(d=>({...d,user:undefined}))});
});
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
 const summary={orders:orders.length,subtotal:money(orders.reduce((a,o)=>a+o.subtotal-o.discount,0)),commission:money(orders.reduce((a,o)=>a+o.commission,0)),delivery:money(orders.reduce((a,o)=>a+o.delivery,0)),merchantNet:money(orders.reduce((a,o)=>a+o.merchantNet,0))};
 res.json({ok:true,summary,settlements:db.settlements.filter(s=>req.user.role==='admin'||s.ownerId===req.user.id)});
});
router.get('/settings',requireAuth,allow('admin'),(req,res)=>res.json({ok:true,settings:read().settings}));
router.get('/payment-methods',(req,res)=>res.json({ok:true,paymentMethods:(read().settings.paymentMethods||[]).filter(x=>x.enabled)}));
router.patch('/settings',requireAuth,allow('admin'),(req,res)=>{
 const db=read();if(req.body.defaultCommission!=null)db.settings.defaultCommission=Math.max(0,Number(req.body.defaultCommission));
 if(req.body.deliveryBase!=null)db.settings.deliveryBase=Math.max(0,Number(req.body.deliveryBase));
 if(req.body.currency)db.settings.currency=String(req.body.currency);
 write(db);res.json({ok:true,settings:db.settings});
});
router.get('/stores',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read();let stores=db.stores;if(req.user.role==='merchant')stores=stores.filter(s=>s.id===req.user.storeId);res.json({ok:true,stores});
});
router.patch('/stores/:id',requireAuth,allow('admin','merchant'),(req,res)=>{
 const db=read(),s=storeFor(db,req.params.id);if(!s)return res.status(404).json({ok:false,message:'المتجر غير موجود'});
 if(req.user.role==='merchant'&&s.id!==req.user.storeId)return res.status(403).json({ok:false});
 for(const k of ['name','category','description','deliveryFee','commission','lat','lng','isOpen'])if(req.body[k]!==undefined)s[k]=req.body[k];
 s.updatedAt=now();write(db);res.json({ok:true,store:s});
});
router.post('/stores',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),s={id:'s_'+uuid(),name:String(req.body.name||'متجر جديد'),category:String(req.body.category||'عام'),description:String(req.body.description||''),rating:5,commission:req.body.commission!=null?Number(req.body.commission):db.settings.defaultCommission,deliveryFee:req.body.deliveryFee!=null?Number(req.body.deliveryFee):db.settings.deliveryBase,isOpen:true,lat:null,lng:null,ownerUserId:req.body.ownerUserId||null};
 db.stores.push(s);write(db);res.status(201).json({ok:true,store:s});
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

router.get('/users',requireAuth,allow('admin'),(req,res)=>{const db=read();res.json({ok:true,users:db.users.map(u=>({id:u.id,name:u.name,phone:u.phone,username:u.username,role:u.role,storeId:u.storeId,driverId:u.driverId,createdAt:u.createdAt}))});});
router.post('/users',requireAuth,allow('admin'),(req,res)=>{
 const db=read(),{name,phone,username,password,role,storeId}=req.body||{};
 if(!name||!username||!password||!['admin','merchant','driver','customer'].includes(role))return res.status(400).json({ok:false,message:'بيانات المستخدم غير صحيحة'});
 if(db.users.some(u=>u.username.toLowerCase()===String(username).toLowerCase()))return res.status(409).json({ok:false,message:'اسم المستخدم مستخدم بالفعل'});
 const u={id:'u_'+uuid(),name:String(name),phone:String(phone||''),username:String(username),password:require('bcryptjs').hashSync(String(password),10),role,storeId:storeId||undefined,createdAt:now()};
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