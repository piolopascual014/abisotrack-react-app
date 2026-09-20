package ph.edu.udm.abisotrack.gateway;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int PERMISSION_REQUEST = 104;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private EditText emailField;
    private EditText passwordField;
    private TextView statusView;
    private Button startButton;
    private Button stopButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildScreen());
        requestNotificationPermission();
        updateStatus();
    }

    private View buildScreen() {
        int padding = dp(24);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(padding, padding, padding, padding);
        page.setBackgroundColor(Color.rgb(247, 249, 252));
        scroll.addView(page, new ScrollView.LayoutParams(-1, -1));

        TextView brand = text("AbisoTrack", 28, Color.WHITE);
        brand.setTypeface(null, 1);
        brand.setPadding(dp(20), dp(22), dp(20), dp(4));
        TextView tagline = text("SMS Gateway · dedicated Android phone", 14, Color.rgb(204, 235, 222));
        tagline.setPadding(dp(20), 0, dp(20), dp(22));
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setBackgroundColor(Color.rgb(6, 78, 59));
        header.addView(brand);
        header.addView(tagline);
        page.addView(header, matchWrap(dp(0), dp(18)));

        TextView title = text("Connect this phone", 23, Color.rgb(5, 56, 45));
        title.setTypeface(null, 1);
        page.addView(title, matchWrap(0, dp(7)));
        TextView intro = text("Sign in with the dedicated Supabase gateway account. Messages are sent only while the gateway is running.", 15, Color.DKGRAY);
        intro.setLineSpacing(0, 1.25f);
        page.addView(intro, matchWrap(0, dp(22)));

        emailField = field("Gateway email");
        emailField.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        new GatewayPrefs(this).email();
        emailField.setText(new GatewayPrefs(this).email());
        page.addView(emailField, matchWrap(0, dp(12)));

        passwordField = field("Password");
        passwordField.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        page.addView(passwordField, matchWrap(0, dp(18)));

        startButton = button("Sign in and start gateway", Color.rgb(6, 78, 59));
        startButton.setOnClickListener(view -> signInAndStart());
        page.addView(startButton, matchHeight(dp(50), dp(10)));

        stopButton = button("Stop gateway", Color.rgb(173, 41, 31));
        stopButton.setOnClickListener(view -> {
            stopService(new Intent(this, GatewayService.class));
            GatewayService.setRunning(false);
            updateStatus();
        });
        page.addView(stopButton, matchHeight(dp(50), dp(24)));

        statusView = text("", 15, Color.DKGRAY);
        statusView.setPadding(dp(18), dp(18), dp(18), dp(18));
        statusView.setBackgroundColor(Color.WHITE);
        statusView.setLineSpacing(0, 1.25f);
        page.addView(statusView, matchWrap(0, dp(18)));

        TextView note = text("Before the demo: set Globe as the default SMS SIM, activate the text promo, keep internet on, and disable battery optimization for this app.", 13, Color.GRAY);
        note.setLineSpacing(0, 1.25f);
        page.addView(note, matchWrap(0, 0));
        return scroll;
    }

    private void signInAndStart() {
        if (!SupabaseGatewayClient.isConfigured()) {
            toast("Build configuration is missing. Add gateway.properties first.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.SEND_SMS}, PERMISSION_REQUEST);
            return;
        }
        String email = emailField.getText().toString().trim();
        String password = passwordField.getText().toString();
        if (email.isBlank() || password.isBlank()) {
            toast("Enter the gateway email and password.");
            return;
        }
        startButton.setEnabled(false);
        statusView.setText("Signing in…");
        executor.execute(() -> {
            try {
                new SupabaseGatewayClient(this).signIn(email, password);
                runOnUiThread(() -> {
                    passwordField.setText("");
                    Intent service = new Intent(this, GatewayService.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service); else startService(service);
                    GatewayService.setRunning(true);
                    updateStatus();
                    toast("Gateway started.");
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    statusView.setText("Sign-in failed: " + safeMessage(error));
                    startButton.setEnabled(true);
                });
            }
        });
    }

    private void updateStatus() {
        if (statusView == null) return;
        GatewayPrefs prefs = new GatewayPrefs(this);
        boolean running = GatewayService.isRunning();
        statusView.setText((running ? "● Gateway running" : "○ Gateway stopped")
                + "\nDevice: " + prefs.gatewayId()
                + "\nAccount: " + (prefs.email().isBlank() ? "Not signed in" : prefs.email())
                + "\nBatch: maximum 5 messages, 4-second spacing");
        startButton.setEnabled(!running);
        stopButton.setEnabled(running);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 105);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) signInAndStart();
            else toast("SMS permission is required to send alerts.");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatus();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    private EditText field(String hint) {
        EditText view = new EditText(this);
        view.setHint(hint);
        view.setTextSize(16);
        view.setSingleLine(true);
        view.setPadding(dp(14), 0, dp(14), 0);
        view.setBackgroundColor(Color.WHITE);
        view.setMinHeight(dp(52));
        return view;
    }

    private Button button(String label, int color) {
        Button view = new Button(this);
        view.setText(label);
        view.setTextColor(Color.WHITE);
        view.setTextSize(15);
        view.setAllCaps(false);
        view.setGravity(Gravity.CENTER);
        view.setBackgroundColor(color);
        return view;
    }

    private LinearLayout.LayoutParams matchWrap(int top, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, top, 0, bottom);
        return params;
    }

    private LinearLayout.LayoutParams matchHeight(int height, int bottom) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, height);
        params.setMargins(0, 0, 0, bottom);
        return params;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
    private static String safeMessage(Exception error) { return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage(); }
}

