package com.hesbah.offer

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
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
class MainActivity:ComponentActivity(){override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);setContent{HesbahApp(Api(this))}}}
@Composable fun HesbahApp(api:Api){
 var session by remember{mutableStateOf(api.session())}
 if(session==null) Login(api){session=api.session()} else if(session!!.role=="driver") DriverHome(api,session!!){api.clear();session=null} else CustomerHome(api,session!!){api.clear();session=null}
}
@Composable fun Login(api:Api,onDone:()->Unit){
 var username by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var error by remember{mutableStateOf("")};val scope=rememberCoroutineScope()
 Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center){
   Text("HESBAH OFFER",style=MaterialTheme.typography.headlineLarge);Text("اطلبها. نجيبها.",style=MaterialTheme.typography.titleMedium);Spacer(Modifier.height(24.dp))
   OutlinedTextField(username,{username=it},label={Text("اسم المستخدم")},modifier=Modifier.fillMaxWidth())
   OutlinedTextField(password,{password=it},label={Text("كلمة المرور")},modifier=Modifier.fillMaxWidth())
   if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
   Button(onClick={scope.launch{try{val j=api.call("/api/auth/login","POST",JSONObject().put("username",username).put("password",password).toString());api.save(j.getString("token"),j.getJSONObject("user"));onDone()}catch(e:Exception){error=e.message?:"خطأ"}}},modifier=Modifier.fillMaxWidth()){Text("دخول")}
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
 DisposableEffect(status){
  if(status!="available"){onDispose{}}
  else{
   val lm=activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
   val listener=object:LocationListener{override fun onLocationChanged(l:Location){gps="GPS: %.5f, %.5f".format(l.latitude,l.longitude);scope.launch{try{api.call("/api/drivers/me/location","PATCH",JSONObject().put("lat",l.latitude).put("lng",l.longitude).toString())}catch(_:Exception){}}}}
   if(androidx.core.content.ContextCompat.checkSelfPermission(activity,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED){
    try{lm.requestLocationUpdates(LocationManager.GPS_PROVIDER,10000L,10f,listener);lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,10000L,10f,listener)}catch(_:Exception){}
   }else activity.requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),77)
   onDispose{try{lm.removeUpdates(listener)}catch(_:Exception){}}
  }
 }
 Column(Modifier.fillMaxSize().padding(16.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("المندوب: ${s.name}");TextButton(onClick=onLogout){Text("خروج")}}
 Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button(onClick={scope.launch{api.call("/api/drivers/me","PATCH",JSONObject().put("status","available").toString());status="available"}}){Text("متاح وابدأ GPS")};Button(onClick={scope.launch{api.call("/api/drivers/me","PATCH",JSONObject().put("status","offline").toString());status="offline"}}){Text("غير متاح")}}
 Text("الحالة: $status");Text(gps);if(message.isNotBlank())Text(message)
 LazyColumn{items(orders){o->Card(Modifier.fillMaxWidth().padding(vertical=5.dp)){Column(Modifier.padding(12.dp)){Text("طلب #"+o.getString("number"));Text("الحالة: "+o.getString("status"));Text(o.optString("address"));if(o.getString("status")=="driver_assigned"){Button(onClick={scope.launch{try{api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","picked_up").toString());load()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("تم الاستلام وابدأ التتبع")}};if(o.getString("status")=="picked_up"){Button(onClick={scope.launch{try{api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","out_for_delivery").toString());load()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("في الطريق")}};if(o.getString("status")=="out_for_delivery"){Button(onClick={scope.launch{try{api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","delivered").toString());load()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("تم التسليم")}}}}}}
 }