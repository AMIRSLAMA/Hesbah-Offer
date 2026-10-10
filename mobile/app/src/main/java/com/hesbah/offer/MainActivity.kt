package com.hesbah.offer

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

private val DeepGreen = Color(0xFF062F25)
private val ForestGreen = Color(0xFF0B4937)
private val Mint = Color(0xFFB8F2D5)
private val WarmWhite = Color(0xFFF5FFF8)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(6, 47, 37)
        window.navigationBarColor = android.graphics.Color.rgb(4, 31, 25)
        window.decorView.systemUiVisibility = 0
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = DeepGreen) {
                    HesbahWebApp()
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun HesbahWebApp() {
    var showWebsite by remember { mutableStateOf(false) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var loading by remember { mutableStateOf(true) }
    var progress by remember { mutableIntStateOf(0) }

    BackHandler(enabled = showWebsite) {
        val current = webView
        if (current != null && current.canGoBack()) current.goBack()
        else showWebsite = false
    }

    if (!showWebsite) {
        WelcomeScreen(onStart = { showWebsite = true })
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(DeepGreen)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(DeepGreen)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("HESBAH OFFER", color = WarmWhite, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text(BuildConfig.APP_SECTION, color = Mint, fontSize = 12.sp)
                }
                Text("حسبة أوفر", color = WarmWhite, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            }
            if (loading) {
                androidx.compose.foundation.layout.LinearProgressIndicator(
                    progress = { (progress.coerceIn(0, 100) / 100f).coerceAtLeast(0.08f) },
                    modifier = Modifier.fillMaxWidth(),
                    color = Mint,
                    trackColor = ForestGreen
                )
            }
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        setBackgroundColor(AndroidColor.rgb(6, 47, 37))
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.loadsImagesAutomatically = true
                        settings.javaScriptCanOpenWindowsAutomatically = false
                        settings.setSupportMultipleWindows(false)
                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                progress = newProgress
                                loading = newProgress < 100
                            }
                        }
                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView?, url: String?) {
                                loading = false
                            }
                        }
                        webView = this
                        loadUrl(BuildConfig.START_URL)
                    }
                },
                update = { webView = it }
            )
        }
    }
}

@Composable
private fun WelcomeScreen(onStart: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF031F19), DeepGreen, ForestGreen, Color(0xFF05271F))
                )
            )
    ) {
        // Decorative shapes keep the welcome screen rich while remaining fully offline.
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 48.dp, end = 18.dp)
                .size(190.dp)
                .background(Color(0xFF17664C).copy(alpha = 0.30f), CircleShape)
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 8.dp, bottom = 68.dp)
                .size(240.dp)
                .background(Color(0xFF0F7654).copy(alpha = 0.20f), CircleShape)
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 26.dp, vertical = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(150.dp)
                    .background(
                        Brush.linearGradient(listOf(Color(0xFF1A7957), Color(0xFF0A3F30))),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(BuildConfig.APP_ICON, fontSize = 66.sp)
            }
            Spacer(Modifier.height(30.dp))
            Text(
                "HESBAH OFFER",
                color = Mint,
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 3.sp
            )
            Spacer(Modifier.height(12.dp))
            Text(
                BuildConfig.WELCOME_TITLE,
                color = WarmWhite,
                fontSize = 30.sp,
                lineHeight = 39.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(14.dp))
            Text(
                BuildConfig.WELCOME_MESSAGE,
                color = Color(0xFFD3E8DD),
                fontSize = 16.sp,
                lineHeight = 27.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(38.dp))
            Button(
                onClick = onStart,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFB8F2D5),
                    contentColor = Color(0xFF063427)
                )
            ) {
                Text("ابدأ الآن  ←", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(18.dp))
            Text(
                "تجربة سهلة • خدمة أسرع • ثقة في كل طلب",
                color = Color(0xFFA6CDBB),
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}
