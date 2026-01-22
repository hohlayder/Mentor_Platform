package ru.hohlayder.mentorapp.network;

import android.content.Context;

import androidx.annotation.NonNull;

import com.google.gson.Gson;

import java.io.IOException;

import okhttp3.Authenticator;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.Route;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.network.dto.auth.RefreshRequest;
import ru.hohlayder.mentorapp.network.dto.auth.RefreshResponse;

public class TokenAuthenticator implements Authenticator {

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final SessionStore store;
    private final String baseUrl;
    private final OkHttpClient refreshClient;
    private final Gson gson = new Gson();

    public TokenAuthenticator(Context context, String baseUrl) {
        this.store = new SessionStore(context.getApplicationContext());
        this.baseUrl = baseUrl == null ? "" : (baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
        this.refreshClient = new OkHttpClient.Builder().build();
    }

    @Override
    public Request authenticate(Route route, @NonNull Response response) {
        if (responseCount(response) >= 2) return null;

        String reqUrl = response.request().url().toString();
        if (reqUrl.contains("/api/v1/auth/login") ||
                reqUrl.contains("/api/v1/auth/register") ||
                reqUrl.contains("/api/v1/auth/refresh") ||
                reqUrl.contains("/api/v1/auth/logout")) {
            return null;
        }

        String refresh = store.getRefreshToken();
        if (refresh == null || refresh.isEmpty()) return null;

        synchronized (this) {
            String currentAccess = store.getAccessToken();
            String requestAuth = response.request().header("Authorization");
            if (currentAccess != null && !currentAccess.isEmpty() && requestAuth != null) {
                String expected = "Bearer " + currentAccess;
                if (!expected.equals(requestAuth)) {
                    return response.request().newBuilder()
                            .header("Authorization", expected)
                            .build();
                }
            }

            RefreshResponse rr = doRefresh(refresh);
            if (rr == null || rr.accessToken == null || rr.accessToken.isEmpty()) return null;

            store.setAccessToken(rr.accessToken);
            if (rr.refreshToken != null && !rr.refreshToken.isEmpty()) {
                store.setRefreshToken(rr.refreshToken);
            }

            return response.request().newBuilder()
                    .header("Authorization", "Bearer " + rr.accessToken)
                    .build();
        }
    }

    private RefreshResponse doRefresh(String refreshToken) {
        try {
            String url = baseUrl + "api/v1/auth/refresh";
            RefreshRequest dto = new RefreshRequest(refreshToken);
            String bodyJson = gson.toJson(dto);

            Request req = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create(bodyJson, JSON))
                    .build();

            Response resp = refreshClient.newCall(req).execute();
            if (!resp.isSuccessful() || resp.body() == null) return null;

            String txt = resp.body().string();
            if (txt == null || txt.isEmpty()) return null;

            return gson.fromJson(txt, RefreshResponse.class);
        } catch (IOException e) {
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private int responseCount(Response response) {
        int count = 1;
        while ((response = response.priorResponse()) != null) {
            count++;
        }
        return count;
    }
}
