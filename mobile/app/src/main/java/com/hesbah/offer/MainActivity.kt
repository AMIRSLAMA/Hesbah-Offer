package com.hesbah.offer

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity

private const val CUSTOMER_URL = "https://hesbah-server.tail957349.ts.net:8443/customer.html"

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var splashScreen: View

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.customer_webview)
        splashScreen = findViewById(R.id.splash_screen)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.loadsImagesAutomatically = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = true
        webView.settings.setSupportMultipleWindows(false)
        webView.setBackgroundColor(android.graphics.Color.WHITE)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val scheme = request.url.scheme
                return scheme != "https" && scheme != "http"
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                webView.visibility = View.VISIBLE
                splashScreen.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    Toast.makeText(
                        this@MainActivity,
                        "تعذر فتح الموقع. تأكد من اتصال الإنترنت وحاول مرة أخرى.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
        webView.webChromeClient = WebChromeClient()

        if (savedInstanceState == null) {
            webView.loadUrl(CUSTOMER_URL)
        } else {
            val restored = webView.restoreState(savedInstanceState)
            if (restored == null) webView.loadUrl(CUSTOMER_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
