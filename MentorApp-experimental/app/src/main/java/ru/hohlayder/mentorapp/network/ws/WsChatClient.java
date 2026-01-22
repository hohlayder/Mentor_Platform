package ru.hohlayder.mentorapp.network.ws;

import android.util.Log;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import ru.hohlayder.mentorapp.network.dto.chat.MessageDto;
import ru.hohlayder.mentorapp.network.dto.chat.WsOutgoingMessage;

public class WsChatClient {
    public interface Listener {
        void onConnected();
        void onDisconnected(String reason);
        void onError(String error);
        void onMessage(MessageDto message);
    }

    private static final String TAG = "WsChatClient";

    private final OkHttpClient client = new OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build();
    private final Gson gson = new Gson();

    private WebSocket ws;
    private Listener listener;
    private final AtomicBoolean connected = new AtomicBoolean(false);

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    public boolean isConnected() {
        return connected.get();
    }

    public void connect(String baseHttpUrl, String accessToken) {
        disconnect();

        String base = trimTrailingSlash(toWsBase(baseHttpUrl));
        String wsUrl = base + "/api/v1/ws?token=" + encode(accessToken);

        Request req = new Request.Builder().url(wsUrl).build();
        ws = client.newWebSocket(req, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                connected.set(true);
                if (listener != null) listener.onConnected();
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    MessageDto msg = gson.fromJson(text, MessageDto.class);
                    if (listener != null) listener.onMessage(msg);
                } catch (JsonSyntaxException e) {
                    Log.e(TAG, "Bad WS message: " + text);
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                Log.w(TAG, "Binary WS message ignored");
            }

            @Override
            public void onClosing(WebSocket webSocket, int code, String reason) {
                webSocket.close(code, reason);
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                connected.set(false);
                if (listener != null) listener.onDisconnected(reason == null ? "" : reason);
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                connected.set(false);
                if (listener != null) listener.onError(t.getMessage() == null ? "WS error" : t.getMessage());
            }
        });
    }

    public void disconnect() {
        if (ws != null) {
            try { ws.close(1000, "bye"); } catch (Exception ignored) {}
            ws = null;
        }
        connected.set(false);
    }

    public boolean send(WsOutgoingMessage msg) {
        if (ws == null || !connected.get()) return false;
        return ws.send(gson.toJson(msg));
    }

    private String toWsBase(String baseHttpUrl) {
        if (baseHttpUrl == null) return "";
        if (baseHttpUrl.startsWith("https://")) return "wss://" + baseHttpUrl.substring("https://".length());
        if (baseHttpUrl.startsWith("http://")) return "ws://" + baseHttpUrl.substring("http://".length());
        return baseHttpUrl;
    }

    private String trimTrailingSlash(String s) {
        if (s == null) return "";
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s;
    }

    private String encode(String s) {
        if (s == null) return "";
        try {
            return URLEncoder.encode(s, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            return s;
        }
    }
}
