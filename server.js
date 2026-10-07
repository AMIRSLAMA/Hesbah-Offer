const express=require('express');
const helmet=require('helmet');
const cors=require('cors');
const morgan=require('morgan');
const path=require('path');
const {ensureDb}=require('./src/store');
const auth=require('./src/auth');
const api=require('./src/api');

const app=express();
const PORT=Number(process.env.PORT||8090);
ensureDb();

app.use(helmet({contentSecurityPolicy:false}));
app.use(cors());
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname,'public')));

app.use('/api/auth',auth);
app.use('/api',api);

app.get('/health',(req,res)=>res.json({ok:true,service:'hesbah-offer',version:'1.0.0'}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,'0.0.0.0',()=>console.log('Hesbah Offer running on http://0.0.0.0:'+PORT));
