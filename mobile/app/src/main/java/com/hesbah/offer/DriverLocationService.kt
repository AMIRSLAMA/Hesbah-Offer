package com.hesbah.offer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel

class DriverLocationService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient()
    private var listener: LocationListener? = null

    override fun onCreate() {
        super.onCreate()
        val channelId = "hesbah_driver_tracking"
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel(channelId, "تتبع التوصيل", NotificationManager.IMPORTANCE_LOW))
        }
        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Hesbah Offer")
            .setContentText("تتبع موقع المندوب نشط أثناء التوصيل")
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(401, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(401, notification)
        }
        startLocationUpdates()
    }

    private fun startLocationUpdates() {
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                sendLocation(location.latitude, location.longitude)
            }
        }
        if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return
        }
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 8000L, 10f, listener!!)
            lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 8000L, 10f, listener!!)
        } catch (_: Exception) {}
    }

    private fun sendLocation(lat: Double, lng: Double) {
        val prefs = getSharedPreferences("hesbah_offer", Context.MODE_PRIVATE)
        val token = prefs.getString("token", "") ?: return
        scope.launch {
            try {
                val body = JSONObject().put("lat", lat).put("lng", lng).toString()
                    .toRequestBody("application/json".toMediaType())
                val req = Request.Builder()
                    .url(BuildConfig.API_URL + "/api/drivers/me/location")
                    .header("Authorization", "Bearer $token")
                    .patch(body)
                    .build()
                client.newCall(req).execute().close()
            } catch (_: Exception) {}
        }
    }

    override fun onDestroy() {
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        listener?.let { try { lm.removeUpdates(it) } catch (_: Exception) {} }
        scope.coroutineContext.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
