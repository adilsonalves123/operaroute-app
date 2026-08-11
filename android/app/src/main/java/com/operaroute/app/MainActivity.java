package com.operaroute.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
  private static final int APP_PERMISSIONS_REQUEST = 1001;
  private boolean permissionsRequested = false;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);

    WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
    if (webView != null) {
      cookies.setAcceptThirdPartyCookies(webView, true);
      // Evita UI antiga: o app carrega o site remoto e o cache do WebView
      // às vezes esconde deploys recentes (foto + IA cassino, etc.).
      webView.clearCache(true);
      WebSettings settings = webView.getSettings();
      settings.setCacheMode(WebSettings.LOAD_DEFAULT);
      settings.setDomStorageEnabled(true);
      settings.setJavaScriptEnabled(true);
      settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
      settings.setGeolocationEnabled(true);
    }
  }

  @Override
  public void onStart() {
    super.onStart();
    if (!permissionsRequested) {
      permissionsRequested = true;
      requestMissingPermissions();
    }
  }

  private void requestMissingPermissions() {
    List<String> permissions = new ArrayList<>();

    addIfMissing(permissions, Manifest.permission.CAMERA);
    addIfMissing(permissions, Manifest.permission.ACCESS_FINE_LOCATION);
    addIfMissing(permissions, Manifest.permission.ACCESS_COARSE_LOCATION);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      addIfMissing(permissions, Manifest.permission.POST_NOTIFICATIONS);
      addIfMissing(permissions, Manifest.permission.READ_MEDIA_IMAGES);
    } else {
      addIfMissing(permissions, Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    if (!permissions.isEmpty()) {
      ActivityCompat.requestPermissions(
          this, permissions.toArray(new String[0]), APP_PERMISSIONS_REQUEST);
    }
  }

  private void addIfMissing(List<String> permissions, String permission) {
    if (ContextCompat.checkSelfPermission(this, permission)
        != PackageManager.PERMISSION_GRANTED) {
      permissions.add(permission);
    }
  }
}
