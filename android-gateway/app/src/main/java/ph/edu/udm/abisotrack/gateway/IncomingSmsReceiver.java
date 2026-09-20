package ph.edu.udm.abisotrack.gateway;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class IncomingSmsReceiver extends BroadcastReceiver {
    private static final String TAG = "AbisoTrackReply";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) return;

        String sender = messages[0].getOriginatingAddress();
        StringBuilder body = new StringBuilder();
        for (SmsMessage message : messages) body.append(message.getMessageBody());
        if (sender == null || !body.toString().trim().matches("^1(?:\\s.*)?$")) return;

        PendingResult pending = goAsync();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                new SupabaseGatewayClient(context).acknowledgeBySms(sender);
                Log.i(TAG, "SMS reply acknowledgement recorded");
            } catch (Exception error) {
                Log.e(TAG, "Could not record SMS acknowledgement", error);
            } finally {
                pending.finish();
                executor.shutdown();
            }
        });
    }
}
