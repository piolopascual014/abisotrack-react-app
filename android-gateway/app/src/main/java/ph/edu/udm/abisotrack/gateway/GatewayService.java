package ph.edu.udm.abisotrack.gateway;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.IBinder;
import android.telephony.SmsManager;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class GatewayService extends Service {
    static final String ACTION_SMS_SENT = "ph.edu.udm.abisotrack.gateway.SMS_SENT";
    static final String ACTION_SMS_DELIVERED = "ph.edu.udm.abisotrack.gateway.SMS_DELIVERED";
    static final String EXTRA_JOB_ID = "job_id";
    static final String EXTRA_GATEWAY_ID = "gateway_id";
    private static final String CHANNEL_ID = "abisotrack_gateway";
    private static volatile boolean running;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    static boolean isRunning() { return running; }
    static void setRunning(boolean value) { running = value; }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(201, notification("Connecting to the SMS queue…"));
        running = true;
        executor.execute(this::pollLoop);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    private void pollLoop() {
        SupabaseGatewayClient client = new SupabaseGatewayClient(this);
        GatewayPrefs prefs = new GatewayPrefs(this);
        String gatewayId = prefs.gatewayId();
        while (running && !Thread.currentThread().isInterrupted()) {
            try {
                if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
                    show("SMS permission missing — open the gateway app");
                    sleep(15_000L);
                    continue;
                }
                List<SmsJob> jobs = client.claim(gatewayId, 5);
                if (jobs.isEmpty()) {
                    show("Running · queue is empty");
                    sleep(15_000L);
                    continue;
                }
                show("Sending " + jobs.size() + " queued message" + (jobs.size() == 1 ? "" : "s"));
                for (SmsJob job : jobs) {
                    if (!running) break;
                    try {
                        sendSms(job, gatewayId);
                        client.updateStatus(job.id, gatewayId, "sent", null);
                    } catch (Exception error) {
                        client.updateStatus(job.id, gatewayId, "failed", safeMessage(error));
                    }
                    sleep(4_000L);
                }
            } catch (Exception error) {
                show("Waiting · " + safeMessage(error));
                sleep(20_000L);
            }
        }
        stopSelf();
    }

    private void sendSms(SmsJob job, String gatewayId) {
        SmsManager manager = getSystemService(SmsManager.class);
        if (manager == null) throw new IllegalStateException("This device cannot send SMS.");
        ArrayList<String> parts = manager.divideMessage(job.message);
        PendingIntent sent = statusIntent(ACTION_SMS_SENT, job.id, gatewayId, 3000 + job.id.hashCode());
        PendingIntent delivered = statusIntent(ACTION_SMS_DELIVERED, job.id, gatewayId, 4000 + job.id.hashCode());
        if (parts.size() <= 1) {
            manager.sendTextMessage(job.phone, null, job.message, sent, delivered);
            return;
        }
        ArrayList<PendingIntent> sentIntents = new ArrayList<>();
        ArrayList<PendingIntent> deliveredIntents = new ArrayList<>();
        for (int index = 0; index < parts.size(); index++) {
            boolean last = index == parts.size() - 1;
            sentIntents.add(last ? sent : null);
            deliveredIntents.add(last ? delivered : null);
        }
        manager.sendMultipartTextMessage(job.phone, null, parts, sentIntents, deliveredIntents);
    }

    private PendingIntent statusIntent(String action, String jobId, String gatewayId, int requestCode) {
        Intent intent = new Intent(this, SmsStatusReceiver.class)
                .setAction(action)
                .putExtra(EXTRA_JOB_ID, jobId)
                .putExtra(EXTRA_GATEWAY_ID, gatewayId);
        return PendingIntent.getBroadcast(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "SMS Gateway", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shows that AbisoTrack is watching the SMS queue.");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification notification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 202, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(ph.edu.udm.abisotrack.gateway.R.drawable.ic_gateway)
                .setContentTitle("AbisoTrack SMS Gateway")
                .setContentText(text)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .build();
    }

    private void show(String text) {
        getSystemService(NotificationManager.class).notify(201, notification(text));
    }

    private static void sleep(long millis) {
        try { Thread.sleep(millis); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
    }

    private static String safeMessage(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
    }

    @Override
    public void onDestroy() {
        running = false;
        executor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}

