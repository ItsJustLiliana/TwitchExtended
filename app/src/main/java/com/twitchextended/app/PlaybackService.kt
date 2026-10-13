package com.twitchextended.app

import android.app.*
import android.content.Intent
import android.os.IBinder

class PlaybackService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("playback", "Playback", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(this, "playback").setContentTitle("Twitch Extended").setContentText("Background playback")
            .setSmallIcon(R.drawable.ic_app).setContentIntent(open).setOngoing(true)
            .setStyle(Notification.MediaStyle().setMediaSession(MainActivity.mediaToken)).build()
        startForeground(1, n)
    }
}
