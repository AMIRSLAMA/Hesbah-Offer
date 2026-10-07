package com.hesbah.offer

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
 var orders by remember{mutableStateOf(emptyList<JSONObject>())};var status by remember{mutableStateOf("offline")};var message by remember{mutableStateOf("")};val scope=rememberCoroutineScope()
 fun load(){scope.launch{try{val j=api.call("/api/orders");val a=j.getJSONArray("orders");orders=(0 until a.length()).map{a.getJSONObject(it)};message=""}catch(e:Exception){message=e.message?:"خطأ"}}}
 LaunchedEffect(Unit){load()}
 Column(Modifier.fillMaxSize().padding(16.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("المندوب: \${s.name}");TextButton(onClick=onLogout){Text("خروج")}}
 Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button(onClick={scope.launch{api.call("/api/drivers/me","PATCH",JSONObject().put("status","available").toString());status="available"}}){Text("متاح")};Button(onClick={scope.launch{api.call("/api/drivers/me","PATCH",JSONObject().put("status","offline").toString());status="offline"}}){Text("غير متاح")}}
 Text("الحالة: $status");if(message.isNotBlank())Text(message)
 LazyColumn{items(orders){o->Card(Modifier.fillMaxWidth().padding(vertical=5.dp)){Column(Modifier.padding(12.dp)){Text("طلب #"+o.getString("number"));Text("الحالة: "+o.getString("status"));Text(o.optString("address"));Button(onClick={scope.launch{try{api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","picked_up").toString());load()}catch(e:Exception){message=e.message?:"خطأ"}}}){Text("تم الاستلام")}}}}}
 }
}