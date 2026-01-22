package ru.hohlayder.mentorapp.core;

import android.content.Context;
import android.content.SharedPreferences;

public class SessionStore {
    private static final String PREFS = "session_store";
    private static final String K_ACCESS = "access_token";
    private static final String K_REFRESH = "refresh_token";
    private static final String K_USER_ID = "user_id";
    private static final String K_LAST_EMAIL = "last_email";

    private final SharedPreferences sp;

    public SessionStore(Context ctx) {
        sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized void clear() {
        sp.edit().clear().apply();
    }

    public synchronized void setAccessToken(String accessToken) {
        sp.edit().putString(K_ACCESS, accessToken).apply();
        String uid = JwtUtils.extractUserId(accessToken);
        if (uid != null && !uid.isEmpty()) {
            sp.edit().putString(K_USER_ID, uid).apply();
        }
    }

    public synchronized void setRefreshToken(String refreshToken) {
        sp.edit().putString(K_REFRESH, refreshToken).apply();
    }

    public synchronized void setUserId(String userId) {
        sp.edit().putString(K_USER_ID, userId).apply();
    }

    public synchronized String getUserId() {
        return sp.getString(K_USER_ID, null);
    }

    public synchronized String getAccessToken() {
        return sp.getString(K_ACCESS, null);
    }

    public synchronized String getRefreshToken() {
        return sp.getString(K_REFRESH, null);
    }

    public synchronized boolean hasSession() {
        String a = getAccessToken();
        String r = getRefreshToken();
        String u = getUserId();
        return a != null && !a.isEmpty() && r != null && !r.isEmpty() && u != null && !u.isEmpty();
    }

    public synchronized void setLastEmail(String email) {
        sp.edit().putString(K_LAST_EMAIL, email).apply();
    }

    public synchronized String getLastEmail() {
        return sp.getString(K_LAST_EMAIL, "");
    }
}
