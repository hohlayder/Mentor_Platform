package ru.hohlayder.mentorapp.network;

import android.content.Context;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;
import ru.hohlayder.mentorapp.core.SessionStore;

public class ApiClient {

    private static Retrofit retrofit;
    private static String baseUrl;

    public static synchronized void init(Context ctx) {
        if (retrofit != null) return;
        build(ctx.getApplicationContext());
    }

    public static synchronized void reinit(Context ctx) {
        retrofit = null;
        build(ctx.getApplicationContext());
    }

    private static void build(Context ctx) {
        if (baseUrl == null || baseUrl.isEmpty()) {
            baseUrl = "http://10.0.2.2:8080/";
        }
        if (!baseUrl.endsWith("/")) baseUrl = baseUrl + "/";

        SessionStore store = new SessionStore(ctx);

        OkHttpClient client = new OkHttpClient.Builder()
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(new AuthHeaderInterceptor(store))
                .authenticator(new TokenAuthenticator(ctx, baseUrl))
                .build();

        retrofit = new Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();
    }

    public static String getBaseUrl(Context ctx) {
        if (baseUrl == null) init(ctx.getApplicationContext());
        return baseUrl;
    }

    public static <T> T create(Class<T> api) {
        if (retrofit == null) {
            throw new IllegalStateException("ApiClient.init(context) must be called before create()");
        }
        return retrofit.create(api);
    }
}
