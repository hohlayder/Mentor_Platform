package ru.hohlayder.mentorapp.core;

import android.util.Log;

import java.io.IOException;

import okhttp3.ResponseBody;
import retrofit2.Response;

public class HttpError {
    public static String read(Response<?> resp) {
        String err = "";
        ResponseBody b = resp.errorBody();
        if (b == null) return err;
        try {
            err = b.string();
        } catch (IOException ignored) {}
        return err;
    }

    public static void log(String tag, Response<?> resp) {
        String s = read(resp);
        if (s != null && !s.isEmpty()) Log.e(tag, s);
    }
}
