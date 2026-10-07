const fs=require('fs');const path=require('path');const bcrypt=require('bcryptjs');
const dir=path.join(__dirname,'..','data');const file=path.join(dir,'db.json');
function seed(){return {settings:{platformName:'Hesbah Offer',defaultCommission:10,deliveryBase:25,currency:'EGP',version:'1.0.0',paymentMethods:[{id:'cash',name:'الدفع عند الاستلام',enabled:true,instructions:'الدفع نقدًا عند استلام الطلب'},{id:'card',name:'بطاقة بنكية',enabled:false,instructions:'الدفع بالبطاقة عند إتمام الطلب'},{id:'wallet',name:'محفظة إلكترونية',enabled:false,instructions:'سيظهر رقم المحفظة هنا عند تفعيلها'}]},
users:[
{id:'u_admin',name:'Hesbah Admin',phone:'01000000000',email:'admin@hesbahoffer.com',username:'admin',password:bcrypt.hashSync('123456',10),role:'admin'},
{id:'u_merchant',name:'Demo Store',phone:'01111111111',email:'merchant@hesbahoffer.com',username:'merchant',password:bcrypt.hashSync('123456',10),role:'merchant',storeId:'s_demo'},
{id:'u_driver',name:'Ahmed Driver',phone:'01222222222',email:'driver@hesbahoffer.com',username:'driver',password:bcrypt.hashSync('123456',10),role:'driver',driverId:'d_demo'}
],
stores:[{id:'s_demo',name:'Hesbah Market',category:'بقالة',description:'متجر تجريبي جاهز للطلبات',rating:4.8,commission:10,deliveryFee:25,isOpen:true,lat:30.0444,lng:31.2357,ownerUserId:'u_merchant'}],
products:[
{id:'p1',storeId:'s_demo',name:'مياه معدنية',description:'زجاجة مياه',price:10,oldPrice:12,image:'',available:true,stock:-1,category:'مشروبات'},
{id:'p2',storeId:'s_demo',name:'عصير مانجو',description:'عصير مانجو',price:35,oldPrice:40,image:'',available:true,stock:-1,category:'مشروبات'},
{id:'p3',storeId:'s_demo',name:'شيبسي',description:'شيبسي عائلي',price:25,oldPrice:30,image:'',available:true,stock:-1,category:'سناكس'}],
drivers:[{id:'d_demo',userId:'u_driver',name:'Ahmed Driver',phone:'01222222222',status:'available',rating:4.9,lat:30.045,lng:31.24,deliveries:128}],
orders:[],coupons:[{id:'WELCOME10',code:'WELCOME10',type:'percent',value:10,minOrder:0,active:true,expiresAt:null}],ratings:[],notifications:[],settlements:[],ledger:[]};}
function ensureDb(){if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(seed(),null,2));}
function read(){ensureDb();return JSON.parse(fs.readFileSync(file,'utf8'))}
function write(db){fs.writeFileSync(file,JSON.stringify(db,null,2));return db}
module.exports={ensureDb,read,write};