package ph.edu.udm.abisotrack.gateway;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.SmsManager;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class SmsStatusReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String jobId = intent.getStringExtra(GatewayService.EXTRA_JOB_ID);
        String gatewayId = intent.getStringExtra(GatewayService.EXTRA_GATEWAY_ID);
        if (jobId == null || gatewayId == null) return;

        boolean delivery = GatewayService.ACTION_SMS_DELIVERED.equals(intent.getAction());
        int result = getResultCode();
        if (delivery && result != Activity.RESULT_OK) return;
        String status = result == Activity.RESULT_OK ? (delivery ? "delivered" : "sent") : "failed";
        String error = result == Activity.RESULT_OK ? null : describe(result);
        PendingResult pending = goAsync();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                new SupabaseGatewayClient(context).updateStatus(jobId, gatewayId, status, error);
            } catch (Exception ignored) {
                // The service already marks successfully handed-off messages as sent.
            } finally {
                pending.finish();
                executor.shutdown();
            }
        });
    }

    private static String describe(int result) {
        return switch (result) {
            case SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "Android reported a generic SMS failure";
            case SmsManager.RESULT_ERROR_NO_SERVICE -> "No cellular service";
            case SmsManager.RESULT_ERROR_NULL_PDU -> "Invalid SMS payload";
            case SmsManager.RESULT_ERROR_RADIO_OFF -> "Mobile radio is off";
            case SmsManager.RESULT_ERROR_LIMIT_EXCEEDED -> "Android SMS sending limit exceeded";
            case SmsManager.RESULT_ERROR_SHORT_CODE_NEVER_ALLOWED -> "Short-code sending is blocked";
            case SmsManager.RESULT_ERROR_SHORT_CODE_NOT_ALLOWED -> "Short-code sending was not allowed";
            default -> "Android SMS error " + result;
        };
    }
}

