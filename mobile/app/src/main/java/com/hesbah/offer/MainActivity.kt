package com.hesbah.offer

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

private const val API=BuildConfig.API_URL
private val JSON="application/json".toMediaType()
data class Session(val token:String,val id:String,val name:String,val role:String,val driverId:String?)
class Api(private val context:Context){
 private fun authBuilder(path:String)=Request.Builder().url(API+path).apply{if(token().isNotBlank())header("Authorization","Bearer "+token())}
 suspend fun driverApplication(fields:Map<String,String>,files:Map<String,Uri>):JSONObject=withContext(Dispatchers.IO){
   val body=MultipartBody.Builder().setType(MultipartBody.FORM).apply{
     fields.forEach{(k,v)->addFormDataPart(k,v)}
     files.forEach{(k,uri)->context.contentResolver.openInputStream(uri)?.use{input->
       val tmp=File.createTempFile("upload_","",context.cacheDir);tmp.outputStream().use{input.copyTo(it)}
       val mime=context.contentResolver.getType(uri)?: "image/jpeg"
       addFormDataPart(k,tmp.name,tmp.asRequestBody(mime.toMediaType()))
     }}
   }.build()
   client.newCall(authBuilder("/api/driver-applications").post(body).build()).execute().use{r->val raw=r.body?.string()?:"{}";val j=JSONObject(raw);if(!r.isSuccessful)throw Exception(j.optString("message","تعذر إرسال الطلب"));j}
 }
 private val client=OkHttpClient()
 private val prefs=context.getSharedPreferences("hesbah_offer",Context.MODE_PRIVATE)
 fun token()=prefs.getString("token","")?:""
 fun session():Session?=prefs.getString("session",null)?.let{val j=JSONObject(it);Session(j.getString("token"),j.getString("id"),j.getString("name"),j.getString("role"),j.optString("driverId").ifBlank{null})}
 fun save(token:String,u:JSONObject){prefs.edit().putString("token",token).putString("session",JSONObject().apply{put("token",token);put("id",u.getString("id"));put("name",u.getString("name"));put("role",u.getString("role"));put("driverId",u.optString("driverId"))}.toString()).apply()}
 fun clear(){prefs.edit().clear().apply()}
 suspend fun call(path:String,method:String="GET",body:String?=null):JSONObject=withContext(Dispatchers.IO){
   val b=body?.toRequestBody(JSON)
   val req=Request.Builder().url(API+path).apply{if(token().isNotBlank())header("Authorization","Bearer "+token())}.method(method,b).build()
   client.newCall(req).execute().use{r->val raw=r.body?.string()?:"{}";val j=JSONObject(raw);if(!r.isSuccessful)throw Exception(j.optString("message","حدث خطأ"));j}
 }
}

@Composable fun DriverRegistration(api:Api,onBack:()->Unit){
 var name by remember{mutableStateOf("")};var phone by remember{mutableStateOf("")};var nationalId by remember{mutableStateOf("")};var address by remember{mutableStateOf("")}
 var vehicleType by remember{mutableStateOf("")};var brand by remember{mutableStateOf("")};var model by remember{mutableStateOf("")};var plate by remember{mutableStateOf("")};var consent by remember{mutableStateOf(false)}
 var message by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)};var currentKey by remember{mutableStateOf("")};val files=remember{mutableStateMapOf<String,Uri>()};val context=LocalContext.current;val scope=rememberCoroutineScope()
 val launcher=rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()){ok->if(ok&&currentKey.isNotBlank()){files[currentKey]=pendingUri}}
 fun camera(key:String){currentKey=key;val file=File.createTempFile("hesbah_"+key+"_","jpg",context.cacheDir);pendingUri=FileProvider.getUriForFile(context,context.packageName+".fileprovider",file);launcher.launch(pendingUri)}
 Column(Modifier.fillMaxSize().padding(18.dp)){TextButton(onClick=onBack){Text("← العودة للدخول")};Text("تسجيل مندوب",style=MaterialTheme.typography.headlineMedium);Text("سيتم مراجعة البيانات قبل تفعيل الحساب.")
 listOf("name" to "الاسم بالكامل","phone" to "رقم الهاتف","nationalId" to "الرقم القومي","address" to "العنوان","vehicleType" to "نوع المركبة","brand" to "الماركة","model" to "الموديل","plate" to "رقم اللوحة").forEach{(k,l)->OutlinedTextField(value=when(k){"name"->name;"phone"->phone;"nationalId"->nationalId;"address"->address;"vehicleType"->vehicleType;"brand"->brand;"model"->model;else->plate},onValueChange={v->when(k){"name"->name=v;"phone"->phone=v;"nationalId"->nationalId=v;"address"->address=v;"vehicleType"->vehicleType=v;"brand"->brand=v;"model"->model=v;else->plate=v}},label={Text(l)},modifier=Modifier.fillMaxWidth().padding(vertical=3.dp))}
 listOf("selfie" to "🤳 صورة سيلفي","idFront" to "🪪 البطاقة - وجه","idBack" to "🪪 البطاقة - ظهر","drivingLicense" to "رخصة القيادة","vehicleLicense" to "رخصة المركبة").forEach{(k,l)->Row(Modifier.fillMaxWidth().padding(vertical=4.dp),horizontalArrangement=Arrangement.SpaceBetween){Text(if(files.containsKey(k))"✓ $l" else "⚠ $l");Button(onClick={camera(k)}){Text("تصوير")}}}
 Row{Checkbox(consent,{consent=it});Text("أوافق على جمع بيانات التحقق والمستندات لغرض التحقق من الهوية والعمل كمندوب لدى Hesbah Offer.")};if(message.isNotBlank())Text(message,color=MaterialTheme.colorScheme.error)
 Button(enabled=!busy,onClick={scope.launch{try{busy=true;message="جاري رفع المستندات...";if(name.isBlank()||phone.isBlank()||nationalId.isBlank()||address.isBlank()||vehicleType.isBlank()||brand.isBlank()||model.isBlank()||plate.isBlank()||!consent||files.size<5)throw Exception("أكمل البيانات وصوّر كل المستندات المطلوبة");val fields=mapOf("name" to name,"phone" to phone,"nationalId" to nationalId,"address" to address,"vehicleType" to vehicleType,"vehicleBrand" to brand,"vehicleModel" to model,"vehiclePlate" to plate,"consent" to "yes");val j=api.driverApplication(fields,files);message="تم إرسال الطلب ✓\\nرقم الطلب: "+j.optString("applicationId");}catch(e:Exception){message=e.message?:"تعذر الإرسال"}finally{busy=false}}},modifier=Modifier.fillMaxWidth()){Text(if(busy)"جاري الإرسال..." else "إرسال طلب التسجيل")}}
}
private lateinit var pendingUri:Uri
class MainActivity:ComponentActivity(){override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);setContent{HesbahApp(Api(this))}}}
@Composable fun HesbahApp(api:Api){
 var session by remember{mutableStateOf(api.session())}
 if(session==null) Login(api){session=api.session()} else if(session!!.role=="driver") DriverHome(api,session!!){api.clear();session=null} else CustomerHome(api,session!!){api.clear();session=null}
}
@Composable fun Login(api:Api,onDone:()->Unit){
 var register by remember{mutableStateOf(false)}
 if(register){DriverRegistration(api){register=false};return}
 var username by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var error by remember{mutableStateOf("")};val scope=rememberCoroutineScope()
 Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center){
   Text("HESBAH OFFER",style=MaterialTheme.typography.headlineLarge);Text("اطلبها. نجيبها.",style=MaterialTheme.typography.titleMedium);Spacer(Modifier.height(24.dp))
   OutlinedTextField(username,{username=it},label={Text("اسم المستخدم")},modifier=Modifier.fillMaxWidth())
   OutlinedTextField(password,{password=it},label={Text("كلمة المرور")},modifier=Modifier.fillMaxWidth())
   if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
   TextButton(onClick={register=true}){Text("تسجيل مندوب جديد")};Spacer(Modifier.height(8.dp));Button(onClick={scope.launch{try{val j=api.call("/api/auth/login","POST",JSONObject().put("username",username).put("password",password).toString());api.save(j.getString("token"),j.getJSONObject("user"));onDone()}catch(e:Exception){error=e.message?:"خطأ"}}},modifier=Modifier.fillMaxWidth()){Text("دخول")}
 }
 }
}
@Composable fun CustomerHome(api:Api,s:Session,onLogout:()->Unit){
 var stores by remember{mutableStateOf(emptyList<JSONObject>())};var message by remember{mutableStateOf("")};val scope=rememberCoroutineScope()
 LaunchedEffect(Unit){try{val j=api.call("/api/marketplace");val a=j.getJSONArray("stores");stores=(0 until a.length()).map{a.getJSONObject(it)}}catch(e:Exception){message=e.message?:"خطأ"}}
 Column(Modifier.fillMaxSize().padding(16.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("أهلاً \${s.name}",style=MaterialTheme.typography.titleLarge);TextButton(onClick=onLogout){Text("خروج")}}
 Text("المتاجر القريبة والعروض",style=MaterialTheme.typography.headlineSmall);if(message.isNotBlank())Text(message)
 LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)){items(stores){st->Card(Modifier.fillMaxWidth()){Column(Modifier.padding(16.dp)){Text(st.getString("name"),style=MaterialTheme.typography.titleLarge);Text(st.optString("category"));Text("⭐ "+st.optDouble("rating",0.0)+" • توصيل "+st.optDouble("deliveryFee",0.0)+" ج.م");Button(onClick={scope.launch{message=try{api.call("/api/stores/"+st.getString("id"));"المتجر جاهز للعرض."}catch(e:Exception){e.message?:"خطأ"}}}){Text("فتح المتجر")}}}}}
 }
}
@Composable fun DriverHome(api:Api,s:Session,onLogout:()->Unit){
 var orders by remember{mutableStateOf(emptyList<JSONObject>())};var status by remember{mutableStateOf("offline")};var message by remember{mutableStateOf("")};var gps by remember{mutableStateOf("GPS متوقف")};val scope=rememberCoroutineScope();val activity=LocalContext.current as Activity
 fun load(){scope.launch{try{val j=api.call("/api/orders");val a=j.getJSONArray("orders");orders=(0 until a.length()).map{a.getJSONObject(it)};message=""}catch(e:Exception){message=e.message?:"خطأ"}}}
 LaunchedEffect(Unit){load()}
 fun startGps(){
  if(android.os.Build.VERSION.SDK_INT>=33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),78)}
  if(activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED && activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED){activity.requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),77);return}
  if(android.os.Build.VERSION.SDK_INT>=26)activity.startForegroundService(android.content.Intent(activity,DriverLocationService::class.java)) else activity.startService(android.content.Intent(activity,DriverLocationService::class.java))
 }
 fun stopGps(){activity.stopService(android.content.Intent(activity,DriverLocationService::class.java))}
 Column(Modifier.fillMaxSize().padding(16.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("المندوب: ${s.name}");TextButton(onClick=onLogout){Text("خروج")}}
 Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button(onClick={scope.launch{try{api.call("/api/drivers/me","PATCH",JSONObject().put("status","available").toString());status="available";startGps()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("متاح وابدأ GPS")};Button(onClick={scope.launch{try{api.call("/api/drivers/me","PATCH",JSONObject().put("status","offline").toString());status="offline";stopGps()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("غير متاح")}}
 Text("الحالة: $status");Text(if(status=="available")"GPS يعمل في الخلفية حتى لو أغلقت الشاشة":"GPS متوقف");if(message.isNotBlank())Text(message)
 LazyColumn{items(orders){o->Card(Modifier.fillMaxWidth().padding(vertical=5.dp)){Column(Modifier.padding(12.dp)){Text("طلب #"+o.getString("number"));Text("الحالة: "+o.getString("status"));Text(o.optString("address"));if(o.getString("status")=="driver_assigned"){Button(onClick={scope.launch{try{api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","picked_up").toString());load()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("تم الاستلام وابدأ التتبع")}};if(o.getString("status")=="picked_up"){Button(onClick={scope.launch{try{api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","out_for_delivery").toString());load()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("في الطريق")}};if(o.getString("status")=="out_for_delivery"){Button(onClick={scope.launch{try{api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","delivered").toString());load()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("تم التسليم")}}}}}}
 }