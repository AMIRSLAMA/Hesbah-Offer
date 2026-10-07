const express=require('express');const jwt=require('jsonwebtoken');const bcrypt=require('bcryptjs');const {read,write}=require('./store');const {v4:uuid}=require('uuid');
const router=express.Router();const secret=()=>process.env.JWT_SECRET||'CHANGE_ME_IN_PRODUCTION';
function safeUser(u){return {id:u.id,name:u.name,phone:u.phone,email:u.email||'',role:u.role,storeId:u.storeId,driverId:u.driverId};}
function issueToken(u){return jwt.sign({id:u.id,role:u.role,storeId:u.storeId,driverId:u.driverId,sessionVersion:u.sessionVersion||0},secret(),{expiresIn:'7d'});}
router.post('/register',(req,res)=>{
 const {name,phone,email,username,password}=req.body||{};if(!name||!phone||!email||!username||!password||String(password).length<6)return res.status(400).json({ok:false,message:'الاسم والهاتف والبريد الإلكتروني واسم المستخدم وكلمة مرور 6 أحرف على الأقل مطلوبة'});const emailValue=String(email).trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))return res.status(400).json({ok:false,message:'البريد الإلكتروني غير صحيح'});
 const db=read();if(db.users.some(u=>u.username.toLowerCase()===String(username).toLowerCase()))return res.status(409).json({ok:false,message:'اسم المستخدم مستخدم بالفعل'});if(db.users.some(u=>String(u.email||'').toLowerCase()===emailValue))return res.status(409).json({ok:false,message:'البريد الإلكتروني مستخدم بالفعل'});
 const u={id:'u_'+uuid(),name:String(name),phone:String(phone),email:emailValue,username:String(username),password:bcrypt.hashSync(String(password),10),role:'customer',sessionVersion:0,createdAt:new Date().toISOString()};db.users.push(u);write(db);
 const token=issueToken(u);res.status(201).json({ok:true,token,user:safeUser(u)});
});
router.post('/login',(req,res)=>{
 const {username,password}=req.body||{},db=read(),u=db.users.find(x=>x.username.toLowerCase()===String(username||'').toLowerCase());
 if(!u||!bcrypt.compareSync(String(password||''),u.password))return res.status(401).json({ok:false,message:'بيانات الدخول غير صحيحة'});
 const ip=req.ip||'';u.lastLoginAt=new Date().toISOString();u.lastLoginIp=ip;u.loginHistory=Array.isArray(u.loginHistory)?u.loginHistory:[];u.loginHistory.push({at:u.lastLoginAt,ip,userAgent:req.get('user-agent')||''});if(u.loginHistory.length>20)u.loginHistory=u.loginHistory.slice(-20);write(db);
 const token=issueToken(u);
 res.json({ok:true,token,user:safeUser(u)});
});
router.get('/me',requireAuth,(req,res)=>{const u=read().users.find(x=>x.id===req.user.id);if(!u)return res.status(401).json({ok:false});res.json({ok:true,user:safeUser(u)});});
function requireAuth(req,res,next){try{const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))throw 0;const payload=jwt.verify(h.slice(7),secret()),u=read().users.find(x=>x.id===payload.id);if(!u||Number(payload.sessionVersion||0)!==Number(u.sessionVersion||0))throw 0;req.user=payload;next()}catch(e){res.status(401).json({ok:false,message:'انتهت الجلسة أو التوكن غير صالح'})}}
function allow(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({ok:false,message:'غير مصرح'});}
module.exports=router;module.exports.requireAuth=requireAuth;module.exports.allow=allow;