package com.operaroute.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);

    WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
    if (webView != null) {
      cookies.setAcceptThirdPartyCookies(webView, true);
      WebSettings settings = webView.getSettings();
      settings.setDomStorageEnabled(true);
      settings.setJavaScriptEnabled(true);
      settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
    }
  }
}
