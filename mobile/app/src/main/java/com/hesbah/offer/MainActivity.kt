package com.hesbah.offer

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
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray

private const val API="http://10.0.2.2:8090"

class MainActivity: ComponentActivity(){
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);setContent{HesbahApp()}}
}
@Composable fun HesbahApp(){
 var logged by remember{mutableStateOf(false)}
 var user by remember{mutableStateOf("")}
 if(!logged) LoginScreen{u->user=u;logged=true} else HomeScreen(user)
}
@Composable fun LoginScreen(onLogin:(String)->Unit){
 var username by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var error by remember{mutableStateOf("")}
 Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center){
  Text("HESBAH OFFER",style=MaterialTheme.typography.headlineLarge);Text("اطلبها. نجيبها.",style=MaterialTheme.typography.titleMedium)
  Spacer(Modifier.height(24.dp));OutlinedTextField(username,{username=it},label={Text("اسم المستخدم")},modifier=Modifier.fillMaxWidth())
  Spacer(Modifier.height(10.dp));OutlinedTextField(password,{password=it},label={Text("كلمة المرور")},modifier=Modifier.fillMaxWidth())
  Spacer(Modifier.height(18.dp));Button(onClick={if(username.isNotBlank()&&password.isNotBlank())onLogin(username)else error="أدخل البيانات"},modifier=Modifier.fillMaxWidth()){Text("دخول")}
  if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
 }
}
@Composable fun HomeScreen(user:String){
 var stores by remember{mutableStateOf(listOf<String>())};var loading by remember{mutableStateOf(true)}
 LaunchedEffect(Unit){stores=withContext(Dispatchers.IO){loadStores()};loading=false}
 Column(Modifier.fillMaxSize().padding(18.dp)){
  Text("أهلاً $user",style=MaterialTheme.typography.headlineSmall);Text("متاجر وعروض قريبة منك",style=MaterialTheme.typography.bodyLarge)
  Spacer(Modifier.height(16.dp))
  if(loading)CircularProgressIndicator() else LazyColumn(verticalArrangement=Arrangement.spacedBy(12.dp)){items(stores){s->Card(Modifier.fillMaxWidth()){Column(Modifier.padding(18.dp)){Text(s,style=MaterialTheme.typography.titleLarge);Text("تصفح المنتجات والعروض");Spacer(Modifier.height(8.dp));Button(onClick={}){Text("فتح المتجر")}}}}}
 }
}
fun loadStores():List<String>{return try{val c=OkHttpClient();val r=c.newCall(Request.Builder().url("$API/api/marketplace").build()).execute();val a=JSONArray(r.body?.string()?.let{org.json.JSONObject(it).getJSONArray("stores").toString()}?:"[]");List(a.length()){a.getJSONObject(it).getString("name")}}catch(e:Exception){listOf("تعذر الاتصال بالسيرفر — تأكد من عنوان API")}}
