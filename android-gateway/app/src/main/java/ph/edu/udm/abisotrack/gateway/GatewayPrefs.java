package ph.edu.udm.abisotrack.gateway;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

final class GatewayPrefs {
    private static final String FILE = "abisotrack_gateway";
    private final SharedPreferences preferences;
    private final Context context;

    GatewayPrefs(Context context) {
        this.context = context.getApplicationContext();
        preferences = this.context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    String gatewayId() {
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.isBlank()) androidId = "unknown";
        return "android-" + androidId;
    }

    void saveSession(String accessToken, String refreshToken, long expiresAtMillis, String email) {
        preferences.edit()
                .putString("access_token", accessToken)
                .putString("refresh_token", refreshToken)
                .putLong("expires_at", expiresAtMillis)
                .putString("email", email)
                .apply();
    }

    String accessToken() { return preferences.getString("access_token", ""); }
    String refreshToken() { return preferences.getString("refresh_token", ""); }
    long expiresAt() { return preferences.getLong("expires_at", 0L); }
    String email() { return preferences.getString("email", ""); }
    boolean hasSession() { return !accessToken().isBlank() && !refreshToken().isBlank(); }

    void clearSession() {
        preferences.edit().remove("access_token").remove("refresh_token").remove("expires_at").remove("email").apply();
    }
}

