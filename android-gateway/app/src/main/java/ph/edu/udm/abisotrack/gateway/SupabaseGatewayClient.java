package ph.edu.udm.abisotrack.gateway;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class SupabaseGatewayClient {
    private final GatewayPrefs prefs;
    private final String baseUrl = BuildConfig.SUPABASE_URL.replaceAll("/+$", "");
    private final String apiKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY;

    SupabaseGatewayClient(Context context) {
        prefs = new GatewayPrefs(context);
    }

    static boolean isConfigured() {
        return !BuildConfig.SUPABASE_URL.contains("YOUR_PROJECT")
                && !BuildConfig.SUPABASE_PUBLISHABLE_KEY.contains("YOUR_PUBLISHABLE_KEY");
    }

    void signIn(String email, String password) throws Exception {
        JSONObject body = new JSONObject().put("email", email.trim()).put("password", password);
        JSONObject response = new JSONObject(request("/auth/v1/token?grant_type=password", body, null));
        saveSession(response, email.trim());
    }

    List<SmsJob> claim(String gatewayId, int limit) throws Exception {
        JSONObject body = new JSONObject().put("p_gateway_id", gatewayId).put("p_limit", limit);
        String response = authorizedRequest("/rest/v1/rpc/gateway_claim_sms", body);
        JSONArray rows = new JSONArray(response);
        List<SmsJob> jobs = new ArrayList<>();
        for (int index = 0; index < rows.length(); index++) {
            JSONObject row = rows.getJSONObject(index);
            jobs.add(new SmsJob(row.getString("job_id"), row.getString("phone"), row.getString("message"), row.optInt("attempt", 1)));
        }
        return jobs;
    }

    void updateStatus(String jobId, String gatewayId, String status, String error) throws Exception {
        JSONObject body = new JSONObject()
                .put("p_job_id", jobId)
                .put("p_gateway_id", gatewayId)
                .put("p_status", status)
                .put("p_error", error == null ? JSONObject.NULL : error);
        authorizedRequest("/rest/v1/rpc/gateway_update_sms", body);
    }

    void acknowledgeBySms(String senderPhone) throws Exception {
        JSONObject body = new JSONObject().put("p_phone", senderPhone);
        authorizedRequest("/rest/v1/rpc/gateway_acknowledge_by_sms", body);
    }

    private synchronized String authorizedRequest(String path, JSONObject body) throws Exception {
        ensureFreshSession();
        try {
            return request(path, body, prefs.accessToken());
        } catch (UnauthorizedException unauthorized) {
            refreshSession();
            return request(path, body, prefs.accessToken());
        }
    }

    private void ensureFreshSession() throws Exception {
        if (!prefs.hasSession()) throw new IllegalStateException("Sign in to the gateway first.");
        if (System.currentTimeMillis() > prefs.expiresAt() - 60_000L) refreshSession();
    }

    private void refreshSession() throws Exception {
        String refreshToken = prefs.refreshToken();
        if (refreshToken.isBlank()) throw new IllegalStateException("Gateway session expired. Sign in again.");
        JSONObject body = new JSONObject().put("refresh_token", refreshToken);
        JSONObject response = new JSONObject(request("/auth/v1/token?grant_type=refresh_token", body, null));
        saveSession(response, prefs.email());
    }

    private void saveSession(JSONObject response, String email) throws Exception {
        String access = response.getString("access_token");
        String refresh = response.getString("refresh_token");
        long expiresIn = response.optLong("expires_in", 3600L);
        prefs.saveSession(access, refresh, System.currentTimeMillis() + expiresIn * 1000L, email);
    }

    private String request(String path, JSONObject body, String accessToken) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(20_000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("apikey", apiKey);
        if (accessToken != null && !accessToken.isBlank()) connection.setRequestProperty("Authorization", "Bearer " + accessToken);
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(payload.length);
        try (OutputStream output = connection.getOutputStream()) { output.write(payload); }

        int status = connection.getResponseCode();
        InputStream input = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        String response = read(input);
        connection.disconnect();
        if (status == 401) throw new UnauthorizedException();
        if (status < 200 || status >= 300) throw new IllegalStateException("Supabase " + status + ": " + response);
        return response;
    }

    private static String read(InputStream input) throws Exception {
        if (input == null) return "";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }

    private static final class UnauthorizedException extends Exception {}
}
