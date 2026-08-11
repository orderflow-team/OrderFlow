package com.obix.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

// Opens WhatsApp directly (bypassing Android's generic "choose an app" share
// sheet) with an image and text pre-attached, so the user only has to pick
// the contact inside WhatsApp itself. WhatsApp doesn't expose any public API
// to also pre-select that contact when media is attached — that combination
// is gated behind the paid Business API — so this is the closest a normal
// app can get: one fewer tap than the OS share sheet, not full automation.
@CapacitorPlugin(name = "WhatsAppShare")
public class WhatsAppSharePlugin extends Plugin {

    private static final String WHATSAPP_PACKAGE = "com.whatsapp";

    @PluginMethod
    public void share(PluginCall call) {
        String imageBase64 = call.getString("imageBase64");
        String text = call.getString("text", "");

        if (imageBase64 == null || imageBase64.isEmpty()) {
            call.reject("imageBase64 is required");
            return;
        }

        Context context = getContext();
        Uri imageUri;
        try {
            imageUri = writeImageToCache(context, imageBase64);
        } catch (IOException e) {
            call.reject("Failed to prepare image for sharing: " + e.getMessage());
            return;
        }

        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setPackage(WHATSAPP_PACKAGE);
        intent.setType("image/png");
        intent.putExtra(Intent.EXTRA_STREAM, imageUri);
        intent.putExtra(Intent.EXTRA_TEXT, text);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            context.startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("WhatsApp is not installed");
        }
    }

    private Uri writeImageToCache(Context context, String base64) throws IOException {
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        File dir = new File(context.getCacheDir(), "share");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Could not create cache share directory");
        }
        File file = new File(dir, "payment-reminder-" + System.currentTimeMillis() + ".png");
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
    }
}
