package fr.renaud.storeflow;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // La WebView ne sait pas télécharger : on confie les fichiers (mise à jour de l'APK) au navigateur
        bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))));
    }
}
