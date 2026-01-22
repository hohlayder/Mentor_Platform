package ru.hohlayder.mentorapp.ui.util;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.widget.ImageView;

import java.io.InputStream;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.AuthHeaderInterceptor;

public class ImageLoader {

    public static void loadPostAvatar(Context ctx, ImageView iv, String avatarUrl) {
        if (iv == null) return;
        if (avatarUrl == null || avatarUrl.trim().isEmpty()) {
            iv.setImageDrawable(null);
            return;
        }
        String u = avatarUrl.trim();
        if (!u.startsWith("http://") && !u.startsWith("https://")) {
            String base = ApiClient.getBaseUrl(ctx.getApplicationContext());
            if (u.startsWith("/")) u = u.substring(1);
            u = base + u;
        }

        SessionStore store = new SessionStore(ctx.getApplicationContext());
        OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(new AuthHeaderInterceptor(store))
                .build();

        Handler h = new Handler(Looper.getMainLooper());
        final String url = u;

        new Thread(() -> {
            Bitmap bmp = null;
            try {
                Request req = new Request.Builder().url(url).get().build();
                Response resp = client.newCall(req).execute();
                if (resp.isSuccessful() && resp.body() != null) {
                    InputStream in = resp.body().byteStream();
                    bmp = BitmapFactory.decodeStream(in);
                }
            } catch (Exception ignored) {}

            Bitmap finalBmp = bmp;
            h.post(() -> {
                if (finalBmp != null) iv.setImageBitmap(finalBmp);
                else iv.setImageDrawable(null);
            });
        }).start();
    }
}