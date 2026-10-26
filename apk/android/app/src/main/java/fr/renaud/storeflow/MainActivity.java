package fr.renaud.storeflow;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // La WebView ne sait pas télécharger : on confie les fichiers (mise à jour de l'APK) au navigateur
        bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))));
    }

    // Barre d'état masquée (elle réapparaît un instant en glissant depuis le haut).
    // Fait ici et non dans onCreate : le plugin SystemBars de Capacitor réaffiche les barres au démarrage.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus) return;
        WindowInsetsControllerCompat insets = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insets.hide(WindowInsetsCompat.Type.statusBars());
        insets.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
