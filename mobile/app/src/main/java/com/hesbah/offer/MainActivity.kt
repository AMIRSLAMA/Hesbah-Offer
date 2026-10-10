package com.hesbah.offer

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.ui.viewinterop.AndroidView
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
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
 suspend fun registerCustomer(name:String,phone:String,email:String,username:String,password:String):JSONObject=call("/api/auth/register","POST",JSONObject().put("name",name).put("phone",phone).put("email",email).put("username",username).put("password",password).toString())
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
    if (BuildConfig.APP_MODE == "customer") {
        CustomerWebsite()
        return
    }
    var session by remember{mutableStateOf(api.session())}
    val expectedRole=BuildConfig.APP_MODE
    LaunchedEffect(session?.role,expectedRole){if(session!=null && session!!.role!=expectedRole){api.clear();session=null}}
    if(session==null) Login(api){session=api.session()}
    else when(expectedRole){
        "driver" -> DriverHome(api,session!!){api.clear();session=null}
        "merchant" -> OperationsHome(api,session!!,false){api.clear();session=null}
        "admin" -> OperationsHome(api,session!!,true){api.clear();session=null}
        else -> CustomerHome(api,session!!){api.clear();session=null}
    }
}

@Composable
private fun CustomerWebsite() {
    val context = LocalContext.current
    val url = BuildConfig.API_URL.trimEnd('/') + "/customer.html"
    var webView by remember { mutableStateOf<WebView?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }

    BackHandler(enabled = webView?.canGoBack() == true) {
        webView?.goBack()
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    webView = this
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.loadsImagesAutomatically = true
                    settings.javaScriptCanOpenWindowsAutomatically = true
                    settings.setSupportMultipleWindows(false)
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = true
                    settings.builtInZoomControls = false
                    settings.displayZoomControls = false
                    CookieManagerCompat.enableCookies(this)
                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                            loading = true
                            loadError = null
                        }
                        override fun onPageFinished(view: WebView?, url: String?) {
                            loading = false
                        }
                        override fun onReceivedError(
                            view: WebView?,
                            request: android.webkit.WebResourceRequest?,
                            error: android.webkit.WebResourceError?
                        ) {
                            if (request?.isForMainFrame == true) {
                                loading = false
                                loadError = "تعذر فتح صفحة العميل. تأكد من اتصال الإنترنت ثم أعد المحاولة."
                            }
                        }
                    }
                    webChromeClient = object : WebChromeClient() {}
                    loadUrl(url)
                }
            },
            update = { view -> webView = view }
        )
        if (loading) {
            CircularProgressIndicator(Modifier.align(androidx.compose.ui.Alignment.Center))
        }
        if (loadError != null) {
            Column(
                Modifier.align(androidx.compose.ui.Alignment.Center).padding(24.dp),
                horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
            ) {
                Text(loadError ?: "")
                Spacer(Modifier.height(12.dp))
                Button(onClick = { loading = true; loadError = null; webView?.reload() }) {
                    Text("إعادة المحاولة")
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            webView?.apply {
                stopLoading()
                destroy()
            }
            webView = null
        }
    }
}

private object CookieManagerCompat {
    fun enableCookies(view: WebView) {
        android.webkit.CookieManager.getInstance().setAcceptCookie(true)
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)
    }
}

@Composable fun Login(api:Api,onDone:()->Unit){
 var register by remember{mutableStateOf(false)};var driverRegister by remember{mutableStateOf(false)}
 if(driverRegister){DriverRegistration(api){driverRegister=false};return}
 if(register){
  var name by remember{mutableStateOf("")};var phone by remember{mutableStateOf("")};var email by remember{mutableStateOf("")};var username by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var error by remember{mutableStateOf("")};val scope=rememberCoroutineScope()
  Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center){
   Text("إنشاء حساب عميل",style=MaterialTheme.typography.headlineMedium);Spacer(Modifier.height(12.dp))
   listOf("الاسم" to {v:String->name=v},"رقم الهاتف" to {v:String->phone=v},"البريد الإلكتروني" to {v:String->email=v},"اسم المستخدم" to {v:String->username=v},"كلمة المرور" to {v:String->password=v}).forEachIndexed{idx,p->OutlinedTextField(value=listOf(name,phone,email,username,password)[idx],onValueChange=p.second,label={Text(p.first)},modifier=Modifier.fillMaxWidth().padding(vertical=4.dp),visualTransformation=if(idx==4) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None)}
   if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
   Button(onClick={scope.launch{try{val j=api.registerCustomer(name,phone,email,username,password);api.save(j.getString("token"),j.getJSONObject("user"));onDone()}catch(e:Exception){error=e.message?:"خطأ"}}},modifier=Modifier.fillMaxWidth()){Text("إنشاء الحساب")}
   TextButton(onClick={register=false}){Text("العودة للدخول")}
  }
  return
 }
 var username by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var error by remember{mutableStateOf("")};val scope=rememberCoroutineScope()
 Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center){
  Text("HESBAH OFFER",style=MaterialTheme.typography.headlineLarge);Text("اطلبها. نجيبها.",style=MaterialTheme.typography.titleMedium);Spacer(Modifier.height(24.dp))
  OutlinedTextField(username,{username=it},label={Text("اسم المستخدم")},modifier=Modifier.fillMaxWidth())
  OutlinedTextField(password,{password=it},label={Text("كلمة المرور")},modifier=Modifier.fillMaxWidth(),visualTransformation=androidx.compose.ui.text.input.PasswordVisualTransformation())
  if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){if(BuildConfig.APP_MODE=="customer")TextButton(onClick={register=true}){Text("تسجيل عميل جديد")};if(BuildConfig.APP_MODE=="driver")TextButton(onClick={driverRegister=true}){Text("تسجيل مندوب جديد")}}
  Button(onClick={scope.launch{try{val j=api.call("/api/auth/login","POST",JSONObject().put("username",username).put("password",password).toString());val user=j.getJSONObject("user");val role=user.optString("role");if(role!=BuildConfig.APP_MODE)throw Exception(when(BuildConfig.APP_MODE){"customer"->"هذا التطبيق مخصص للعملاء";"merchant"->"هذا التطبيق مخصص للتجار";"driver"->"هذا التطبيق مخصص لمندوبي التوصيل";else->"هذا التطبيق مخصص للإدارة"});api.save(j.getString("token"),user);onDone()}catch(e:Exception){error=e.message?:"خطأ"}}},modifier=Modifier.fillMaxWidth()){Text("دخول")}
 }
}
data class CartLine(val productId:String,val name:String,val price:Double,val qty:Int,val storeId:String)

@Composable
fun CustomerHome(api:Api,s:Session,onLogout:()->Unit){
    val navy=Color(0xFF172554)
    val teal=Color(0xFF0F9D91)
    val pale=Color(0xFFF4F7FB)
    var stores by remember{mutableStateOf(emptyList<JSONObject>())}
    var products by remember{mutableStateOf(emptyList<JSONObject>())}
    var orders by remember{mutableStateOf(emptyList<JSONObject>())}
    var selectedStore by remember{mutableStateOf<JSONObject?>(null)}
    var cart by remember{mutableStateOf(emptyList<CartLine>())}
    var address by remember{mutableStateOf("")}
    var coupon by remember{mutableStateOf("")}
    var paymentMethods by remember{mutableStateOf(emptyList<JSONObject>())}
    var payment by remember{mutableStateOf("")}
    var message by remember{mutableStateOf("")}
    var showOrders by remember{mutableStateOf(false)}
    var search by remember{mutableStateOf("")}
    val scope=rememberCoroutineScope()
    fun loadOrders(){
        scope.launch{try{val j=api.call("/api/orders");val a=j.getJSONArray("orders");orders=(0 until a.length()).map{a.getJSONObject(it)}}catch(e:Exception){message=e.message?:"تعذر تحميل الطلبات"}}
    }
    LaunchedEffect(Unit){
        try{val j=api.call("/api/marketplace");val a=j.getJSONArray("stores");stores=(0 until a.length()).map{a.getJSONObject(it)}
            val pm=api.call("/api/payment-methods").getJSONArray("paymentMethods");paymentMethods=(0 until pm.length()).map{pm.getJSONObject(it)}
            if(paymentMethods.isNotEmpty())payment=paymentMethods[0].getString("id");loadOrders()
        }catch(e:Exception){message=e.message?:"تعذر تحميل البيانات"}
    }
    fun addProduct(p:JSONObject,storeId:String){
        if(cart.isNotEmpty()&&cart[0].storeId!=storeId){message="السلة لا تجمع منتجات من متجرين";return}
        val id=p.getString("id");val old=cart.find{it.productId==id}
        cart=if(old==null)cart+CartLine(id,p.getString("name"),p.getDouble("price"),1,storeId)else cart.map{if(it.productId==id)it.copy(qty=it.qty+1)else it}
        message="تمت إضافة المنتج إلى السلة ✓"
    }
    fun checkout(){
        scope.launch{try{if(cart.isEmpty())throw Exception("السلة فارغة");if(address.isBlank())throw Exception("اكتب عنوان التوصيل")
            val items=org.json.JSONArray();cart.forEach{items.put(JSONObject().put("productId",it.productId).put("qty",it.qty))}
            val body=JSONObject().put("storeId",cart[0].storeId).put("items",items).put("address",address).put("paymentMethod",payment).put("coupon",coupon)
            val j=api.call("/api/orders","POST",body.toString());message="تم إنشاء الطلب #"+j.getJSONObject("order").getString("number");cart=emptyList();loadOrders()
        }catch(e:Exception){message=e.message?:"تعذر إنشاء الطلب"}}
    }
    Column(Modifier.fillMaxSize().background(pale)){
        Row(Modifier.fillMaxWidth().background(navy).padding(horizontal=18.dp,vertical=16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
            Column{Text("HESBAH",color=Color.White,fontWeight=FontWeight.Black,style=MaterialTheme.typography.titleLarge);Text("حسبة أوفر • كل اللي بتحبه أقرب لك",color=Color(0xFFB8D8E8),style=MaterialTheme.typography.bodySmall)}
            Column(horizontalAlignment=androidx.compose.ui.Alignment.End){Text("أهلاً، ${s.name}",color=Color.White,fontWeight=FontWeight.SemiBold);TextButton(onClick=onLogout,contentPadding=PaddingValues(0.dp)){Text("تسجيل الخروج",color=Color(0xFFB8D8E8))}}
        }
        if(message.isNotBlank())Text(message,Modifier.fillMaxWidth().background(Color(0xFFE4F7F1)).padding(horizontal=16.dp,vertical=8.dp),color=Color(0xFF087F70),style=MaterialTheme.typography.bodySmall)
        if(showOrders){
            Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){Text("طلباتي",style=MaterialTheme.typography.headlineSmall,color=navy,fontWeight=FontWeight.Bold);TextButton(onClick={showOrders=false}){Text("العودة للمتاجر")}}
            LazyColumn(Modifier.weight(1f).padding(horizontal=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                items(orders){o->Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(18.dp),colors=CardDefaults.cardColors(containerColor=Color.White)){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
                    Text("طلب #"+o.optString("number"),style=MaterialTheme.typography.titleMedium,color=navy,fontWeight=FontWeight.Bold)
                    Text("الحالة: "+o.optString("status"),color=teal,fontWeight=FontWeight.SemiBold)
                    Text("الإجمالي: "+o.optDouble("total")+" ج.م");Text(o.optString("address"),color=Color.Gray)
                    if(o.optString("status")=="picked_up"||o.optString("status")=="out_for_delivery")Button(onClick={scope.launch{try{val t=api.call("/api/orders/"+o.getString("id")+"/tracking").getJSONObject("tracking");val d=t.optJSONObject("driver");message="المندوب: "+(d?.optString("name")?:"-")+" | الموقع: "+(d?.optDouble("lat",0.0))+", "+(d?.optDouble("lng",0.0))}catch(e:Exception){message=e.message?:"تعذر تحديث الموقع"}}},colors=ButtonDefaults.buttonColors(containerColor=teal)){Text("📍 تحديث موقع المندوب")}}
                }}
            }
        }else if(selectedStore==null){
            LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(bottom=18.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
                item{
                    Column(Modifier.padding(horizontal=16.dp,vertical=14.dp)){
                        Text("طلبك المفضل، على بُعد خطوات",style=MaterialTheme.typography.headlineSmall,color=navy,fontWeight=FontWeight.ExtraBold)
                        Spacer(Modifier.height(5.dp));Text("اكتشف المحلات والعروض اللي حواليك",color=Color(0xFF64748B))
                        Spacer(Modifier.height(14.dp))
                        OutlinedTextField(value=search,onValueChange={search=it},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(16.dp),label={Text("🔎  بتدور على إيه؟")},colors=OutlinedTextFieldDefaults.colors(unfocusedContainerColor=Color.White,focusedContainerColor=Color.White))
                    }
                }
                item{
                    Column(Modifier.padding(horizontal=16.dp).fillMaxWidth().background(teal, RoundedCornerShape(22.dp)).padding(18.dp)){
                        Text("عروض حسبة أوفر",color=Color.White,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.ExtraBold)
                        Text("وفّر في طلبك الجاي واستمتع بتجربة أسهل",color=Color.White)
                        Spacer(Modifier.height(10.dp))
                        Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){Text("🍔",style=MaterialTheme.typography.displaySmall);Spacer(Modifier.width(10.dp));Column{Text("كل اللي بتحبه في مكان واحد",color=Color.White,fontWeight=FontWeight.Bold);Text("مطاعم • بقالة • احتياجات يومية",color=Color.White)}}
                    }
                }
                item{
                    Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
                        Text("متاجر قريبة منك",style=MaterialTheme.typography.titleLarge,color=navy,fontWeight=FontWeight.Bold)
                        TextButton(onClick={loadOrders();showOrders=true}){Text("طلباتي",color=teal)}
                    }
                }
                items(stores.filter{it.optString("name").contains(search,true)||it.optString("category").contains(search,true)}){st->
                    Card(Modifier.fillMaxWidth().padding(horizontal=14.dp),shape=RoundedCornerShape(20.dp),colors=CardDefaults.cardColors(containerColor=Color.White),elevation=CardDefaults.cardElevation(defaultElevation=2.dp)){
                        Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
                            Box(Modifier.size(82.dp).background(Color(0xFFE8F5F3),RoundedCornerShape(16.dp)),contentAlignment=androidx.compose.ui.Alignment.Center){Text("🛍️",style=MaterialTheme.typography.headlineLarge)}
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)){
                                Text(st.optString("name"),style=MaterialTheme.typography.titleMedium,color=navy,fontWeight=FontWeight.Bold)
                                Text(st.optString("category","متجر"),color=Color(0xFF64748B))
                                Text("⭐ "+st.optDouble("rating",0.0)+"  •  توصيل "+st.optDouble("deliveryFee",0.0)+" ج.م",style=MaterialTheme.typography.bodySmall,color=Color(0xFF475569))
                                Button(onClick={scope.launch{try{val j=api.call("/api/stores/"+st.getString("id"));selectedStore=st;val a=j.getJSONArray("products");products=(0 until a.length()).map{a.getJSONObject(it)};message=""}catch(e:Exception){message=e.message?:"تعذر فتح المتجر"} }},shape=RoundedCornerShape(12.dp),colors=ButtonDefaults.buttonColors(containerColor=navy),contentPadding=PaddingValues(horizontal=18.dp,vertical=6.dp)){Text("تصفح المنتجات")}
                            }
                        }
                    }
                }
            }
        }else{
            Row(Modifier.fillMaxWidth().padding(16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
                Column{Text(selectedStore!!.optString("name"),style=MaterialTheme.typography.headlineSmall,color=navy,fontWeight=FontWeight.Bold);Text(selectedStore!!.optString("category"),color=Color.Gray)}
                TextButton(onClick={selectedStore=null}){Text("← المتاجر",color=teal)}
            }
            LazyColumn(Modifier.weight(1f).padding(horizontal=14.dp),verticalArrangement=Arrangement.spacedBy(10.dp),contentPadding=PaddingValues(bottom=10.dp)){
                items(products.filter{it.optBoolean("available",false)&&it.optInt("stock",-1)!=0}){p->
                    Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(18.dp),colors=CardDefaults.cardColors(containerColor=Color.White)){Row(Modifier.padding(14.dp),verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
                        Box(Modifier.size(68.dp).background(Color(0xFFFFF1E6),RoundedCornerShape(14.dp)),contentAlignment=androidx.compose.ui.Alignment.Center){Text("🍽️",style=MaterialTheme.typography.headlineMedium)}
                        Spacer(Modifier.width(12.dp));Column(Modifier.weight(1f)){Text(p.optString("name"),style=MaterialTheme.typography.titleMedium,color=navy,fontWeight=FontWeight.Bold);Text(p.optString("description"),color=Color.Gray,style=MaterialTheme.typography.bodySmall);Spacer(Modifier.height(5.dp));Text(p.optDouble("price").toString()+" ج.م",color=teal,fontWeight=FontWeight.Bold)}
                        Button(onClick={addProduct(p,selectedStore!!.getString("id"))},shape=RoundedCornerShape(12.dp),colors=ButtonDefaults.buttonColors(containerColor=teal)){Text("+")}
                    }}
                }
            }
            Column(Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(topStart=24.dp,topEnd=24.dp)).padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                Text("السلة • ${cart.sumOf{it.qty}} قطعة",style=MaterialTheme.typography.titleMedium,color=navy,fontWeight=FontWeight.Bold)
                Text("الإجمالي: ${cart.sumOf{it.price*it.qty}} ج.م",style=MaterialTheme.typography.titleLarge,color=teal,fontWeight=FontWeight.ExtraBold)
                OutlinedTextField(address,{address=it},label={Text("عنوان التوصيل")},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(12.dp))
                OutlinedTextField(coupon,{coupon=it},label={Text("كود الخصم (اختياري)")},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(12.dp))
                if(paymentMethods.isNotEmpty()){Text("طريقة الدفع",fontWeight=FontWeight.SemiBold,color=navy);paymentMethods.forEach{pm->Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){RadioButton(selected=payment==pm.getString("id"),onClick={payment=pm.getString("id")},colors=RadioButtonDefaults.colors(selectedColor=teal));Text(pm.getString("name"))}}}
                Button(onClick={checkout()},modifier=Modifier.fillMaxWidth().height(52.dp),shape=RoundedCornerShape(14.dp),colors=ButtonDefaults.buttonColors(containerColor=navy)){Text("تأكيد الطلب  ←",fontWeight=FontWeight.Bold)}
            }
        }
    }
}
@Composable
fun DriverHome(api:Api,s:Session,onLogout:()->Unit){
    var orders by remember{mutableStateOf(emptyList<JSONObject>())}
    var status by remember{mutableStateOf("offline")}
    var message by remember{mutableStateOf("")}
    val scope=rememberCoroutineScope()
    val activity=LocalContext.current as Activity

    fun load(){
        scope.launch{
            try{
                val j=api.call("/api/orders")
                val a=j.getJSONArray("orders")
                orders=(0 until a.length()).map{a.getJSONObject(it)}
            }catch(e:Exception){message=e.message?:"تعذر تحميل الطلبات"}
        }
    }
    fun startGps(){
        if(android.os.Build.VERSION.SDK_INT>=33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS),78)
        }
        if(activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED &&
           activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            activity.requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),77)
            return
        }
        val intent=android.content.Intent(activity,DriverLocationService::class.java)
        if(android.os.Build.VERSION.SDK_INT>=26) activity.startForegroundService(intent) else activity.startService(intent)
    }
    fun stopGps(){activity.stopService(android.content.Intent(activity,DriverLocationService::class.java))}
    LaunchedEffect(Unit){load()}

    Column(Modifier.fillMaxSize().padding(16.dp)){
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
            Text("المندوب: "+s.name,style=MaterialTheme.typography.titleLarge)
            TextButton(onClick={stopGps();onLogout()}){Text("خروج")}
        }
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
            Button(onClick={
                scope.launch{
                    try{
                        api.call("/api/drivers/me","PATCH",JSONObject().put("status","available").toString())
                        status="available"
                        startGps()
                        load()
                    }catch(e:Exception){message=e.message?:"خطأ"}
                }
            }){Text("متاح وابدأ GPS")}
            Button(onClick={
                scope.launch{
                    try{
                        api.call("/api/drivers/me","PATCH",JSONObject().put("status","offline").toString())
                        status="offline"
                        stopGps()
                    }catch(e:Exception){message=e.message?:"خطأ"}
                }
            }){Text("غير متاح")}
        }
        Text("الحالة: "+status)
        Text(if(status=="available")"GPS يعمل في الخلفية أثناء التوصيل" else "GPS متوقف")
        if(message.isNotBlank())Text(message,color=MaterialTheme.colorScheme.error)
        LazyColumn{
            items(orders){o->
                Card(Modifier.fillMaxWidth().padding(vertical=5.dp)){
                    Column(Modifier.padding(12.dp)){
                        Text("طلب #"+o.getString("number"))
                        Text("الحالة: "+o.getString("status"))
                        Text(o.optString("address"))
                        when(o.getString("status")){
                            "driver_assigned" -> Button(onClick={
                                scope.launch{
                                    try{
                                        api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","picked_up").toString())
                                        load()
                                    }catch(e:Exception){message=e.message?:"خطأ"}
                                }
                            }){Text("تم الاستلام وابدأ التتبع")}
                            "picked_up" -> Button(onClick={
                                scope.launch{
                                    try{
                                        api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","out_for_delivery").toString())
                                        load()
                                    }catch(e:Exception){message=e.message?:"خطأ"}
                                }
                            }){Text("في الطريق")}
                            "out_for_delivery" -> Button(onClick={
                                scope.launch{
                                    try{
                                        api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status","delivered").toString())
                                        load()
                                    }catch(e:Exception){message=e.message?:"خطأ"}
                                }
                            }){Text("تم التسليم")}
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OperationsHome(api:Api,s:Session,isAdmin:Boolean,onLogout:()->Unit){
 var orders by remember{mutableStateOf(emptyList<JSONObject>())}
 var products by remember{mutableStateOf(emptyList<JSONObject>())}
 var stats by remember{mutableStateOf<JSONObject?>(null)}
 var message by remember{mutableStateOf("")}
 var showProducts by remember{mutableStateOf(false)}
 val scope=rememberCoroutineScope()
 fun load(){
  scope.launch{
   try{
    val oj=api.call("/api/orders").getJSONArray("orders")
    orders=(0 until oj.length()).map{oj.getJSONObject(it)}
    if(isAdmin) stats=api.call("/api/dashboard").getJSONObject("stats")
    if(!isAdmin){
     val pj=api.call("/api/products/manage").getJSONArray("products")
     products=(0 until pj.length()).map{pj.getJSONObject(it)}
    }
    message=""
   }catch(e:Exception){message=e.message?:"تعذر تحميل البيانات"}
  }
 }
 LaunchedEffect(Unit){load()}
 Column(Modifier.fillMaxSize().padding(16.dp)){
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
   Text(if(isAdmin)"لوحة الإدارة" else "إدارة المتجر",style=MaterialTheme.typography.titleLarge)
   TextButton(onClick=onLogout){Text("خروج")}
  }
  Text("مرحباً ${s.name}")
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
   Button(onClick={showProducts=false;load()}){Text("الطلبات")}
   if(!isAdmin)Button(onClick={showProducts=true;load()}){Text("المنتجات")}
   TextButton(onClick={ { load() } }){Text("تحديث")}
  }
  if(message.isNotBlank())Text(message,color=MaterialTheme.colorScheme.error)
  if(isAdmin && stats!=null){
   val st=stats!!
   Card(Modifier.fillMaxWidth().padding(vertical=6.dp)){Column(Modifier.padding(12.dp)){
    Text("ملخص المنصة",style=MaterialTheme.typography.titleMedium)
    Text("إجمالي الطلبات: "+st.optInt("orders"))
    Text("الطلبات النشطة: "+st.optInt("pending"))
    Text("المتاجر: "+st.optInt("stores")+" • المندوبون: "+st.optInt("drivers"))
    Text("العملاء: "+st.optInt("customers"))
    Text("الإيرادات: "+st.optDouble("revenue")+" ج.م")
   }}
  }
  if(showProducts && !isAdmin){
   LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
    items(products){p->Card(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp)){
     Text(p.optString("name"),style=MaterialTheme.typography.titleMedium)
     Text("السعر: "+p.optDouble("price")+" ج.م")
     Text(if(p.optBoolean("available",true))"متاح" else "غير متاح")
     Text("المخزون: "+p.optInt("stock",-1).let{if(it<0)"غير محدود" else it.toString()})
    }}}
   }
  }else{
   LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
    items(orders){o->
     Card(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp)){
      Text("طلب #"+o.optString("number"),style=MaterialTheme.typography.titleMedium)
      Text("الحالة: "+o.optString("status"))
      Text("الإجمالي: "+o.optDouble("total")+" ج.م")
      Text(o.optString("address"))
      val status=o.optString("status")
      val next=when(status){"pending"->"accepted";"accepted"->"preparing";"preparing"->"ready_for_pickup";else->""}
      if(next.isNotBlank()){
       Button(onClick={scope.launch{try{
        api.call("/api/orders/"+o.getString("id")+"/status","PATCH",JSONObject().put("status",next).toString())
        message="تم تحديث حالة الطلب";load()
       }catch(e:Exception){message=e.message?:"تعذر تحديث الطلب"}}}){Text(when(next){"accepted"->"قبول الطلب";"preparing"->"بدء التجهيز";else->"جاهز للاستلام"})}
      }
     }}
    }
   }
  }
 }
}
