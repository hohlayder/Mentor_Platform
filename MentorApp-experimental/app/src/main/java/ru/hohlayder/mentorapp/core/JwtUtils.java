package ru.hohlayder.mentorapp.core;

import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

public class JwtUtils {

    public static String extractUserId(String jwt) {
        if (jwt == null) return null;
        String[] parts = jwt.split("\\.");
        if (parts.length < 2) return null;

        try {
            String payloadJson = new String(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP), StandardCharsets.UTF_8);
            JSONObject obj = new JSONObject(payloadJson);

            if (obj.has("UserId")) return obj.optString("UserId", null);
            if (obj.has("user_id")) return obj.optString("user_id", null);
            if (obj.has("sub")) return obj.optString("sub", null);

            return null;
        } catch (Exception e) {
            return null;
        }
    }
}
