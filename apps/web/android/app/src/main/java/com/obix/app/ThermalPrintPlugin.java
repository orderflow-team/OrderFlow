package com.obix.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Renders receipt HTML off-screen and hands it straight to Android's native
 * PrintManager — the same system print dialog Chrome's "Print" menu item
 * opens — instead of routing through window.open()/an external browser tab.
 * A plain Capacitor WebView never shows any UI for JS window.print() calls
 * (that's what left the old flow stuck full-screen with no way out), so the
 * print dialog has to be triggered from the native side.
 */
@CapacitorPlugin(name = "ThermalPrint")
public class ThermalPrintPlugin extends Plugin {

    @PluginMethod()
    public void print(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.isEmpty()) {
            call.reject("html is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            WebView webView = new WebView(getContext());
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    Context context = getContext();
                    PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) {
                        call.reject("Printing is not supported on this device");
                        return;
                    }
                    PrintDocumentAdapter adapter = view.createPrintDocumentAdapter("Receipt");
                    printManager.print("Receipt", adapter, new PrintAttributes.Builder().build());
                    call.resolve();
                }
            });
            webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }
}
