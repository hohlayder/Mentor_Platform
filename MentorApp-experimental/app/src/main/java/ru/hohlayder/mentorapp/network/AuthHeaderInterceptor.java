package ru.hohlayder.mentorapp.network;

import java.io.IOException;

import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;
import ru.hohlayder.mentorapp.core.SessionStore;

public class AuthHeaderInterceptor implements Interceptor {
    private final SessionStore store;

    public AuthHeaderInterceptor(SessionStore store) {
        this.store = store;
    }

    @Override
    public Response intercept(Chain chain) throws IOException {
        Request req = chain.request();
        String token = store.getAccessToken();
        if (token == null || token.isEmpty()) return chain.proceed(req);

        Request withAuth = req.newBuilder()
                .header("Authorization", "Bearer " + token)
                .build();
        return chain.proceed(withAuth);
    }
}
