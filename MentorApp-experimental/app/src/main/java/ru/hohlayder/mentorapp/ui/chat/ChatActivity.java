package ru.hohlayder.mentorapp.ui.chat;

import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityChatBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.ChatApi;
import ru.hohlayder.mentorapp.network.UsersApi;
import ru.hohlayder.mentorapp.network.dto.chat.ChatDto;
import ru.hohlayder.mentorapp.network.dto.chat.GetChatByIdResponse;
import ru.hohlayder.mentorapp.network.dto.chat.GetChatMessagesResponse;
import ru.hohlayder.mentorapp.network.dto.chat.MarkMessagesReadRequest;
import ru.hohlayder.mentorapp.network.dto.chat.MarkMessagesReadResponse;
import ru.hohlayder.mentorapp.network.dto.chat.MessageDto;
import ru.hohlayder.mentorapp.network.dto.chat.WsOutgoingMessage;
import ru.hohlayder.mentorapp.network.dto.user.UserDto;
import ru.hohlayder.mentorapp.network.ws.WsChatClient;

public class ChatActivity extends AppCompatActivity {
    public static final String EXTRA_CHAT_ID = "chat_id";

    private ActivityChatBinding b;
    private ChatApi chatApi;
    private UsersApi usersApi;
    private SessionStore store;

    private MessagesAdapter adapter;
    private final List<MessageDto> data = new ArrayList<>();

    private String chatId;
    private String otherUserId = "";
    private String otherUserName = "";

    private WsChatClient ws;
    private boolean firstLoadDone = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityChatBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        chatApi = ApiClient.create(ChatApi.class);
        usersApi = ApiClient.create(UsersApi.class);
        store = new SessionStore(getApplicationContext());

        chatId = getIntent().getStringExtra(EXTRA_CHAT_ID);
        if (chatId == null || chatId.isEmpty()) {
            Toast.makeText(this, "No chatId", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        b.tvTitle.setText("Chat");
        b.btnBack.setOnClickListener(v -> finish());

        adapter = new MessagesAdapter(data, store.getUserId());
        LinearLayoutManager lm = new LinearLayoutManager(this);
        lm.setStackFromEnd(true);
        b.recycler.setLayoutManager(lm);
        b.recycler.setAdapter(adapter);

        b.swipe.setOnRefreshListener(this::load);

        b.etInput.setEnabled(true);
        b.btnSend.setEnabled(true);
        b.btnSend.setOnClickListener(v -> sendMessage());

        ws = new WsChatClient();
        ws.setListener(new WsChatClient.Listener() {
            @Override
            public void onConnected() { }

            @Override
            public void onDisconnected(String reason) { }

            @Override
            public void onError(String error) { }

            @Override
            public void onMessage(MessageDto message) {
                if (message == null) return;
                if (message.chatId == null || !message.chatId.equals(chatId)) return;

                runOnUiThread(() -> {
                    data.add(message);
                    adapter.notifyItemInserted(data.size() - 1);
                    b.recycler.scrollToPosition(Math.max(0, data.size() - 1));
                    markSingleAsReadIfNeeded(message);
                });
            }
        });

        loadHeader();
        load();
    }

    @Override
    protected void onStart() {
        super.onStart();
        connectWs();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (ws != null) ws.disconnect();
    }

    private void loadHeader() {
        chatApi.getChatById(chatId).enqueue(new Callback<GetChatByIdResponse>() {
            @Override
            public void onResponse(Call<GetChatByIdResponse> call, Response<GetChatByIdResponse> resp) {
                if (!resp.isSuccessful() || resp.body() == null || resp.body().chat == null) return;

                ChatDto c = resp.body().chat;
                String me = store.getUserId();
                String other = "";
                if (me != null && !me.isEmpty()) {
                    if (me.equals(c.user1Id)) other = c.user2Id;
                    else if (me.equals(c.user2Id)) other = c.user1Id;
                    else other = c.user2Id;
                } else other = c.user2Id;

                otherUserId = other == null ? "" : other;
                if (otherUserId.isEmpty()) return;

                usersApi.getById(otherUserId).enqueue(new Callback<UserDto>() {
                    @Override
                    public void onResponse(Call<UserDto> call, Response<UserDto> resp2) {
                        if (!resp2.isSuccessful() || resp2.body() == null) return;

                        UserDto u = resp2.body();
                        String fn = u.firstName == null ? "" : u.firstName;
                        String ln = u.lastName == null ? "" : u.lastName;
                        String name = (fn + " " + ln).trim();
                        if (name.isEmpty()) name = u.email == null ? "" : u.email;

                        otherUserName = name == null ? "" : name.trim();
                        if (!otherUserName.isEmpty()) {
                            runOnUiThread(() -> {
                                b.tvTitle.setText(otherUserName);
                                adapter.setOtherUserName(otherUserName);
                            });
                        }
                    }

                    @Override
                    public void onFailure(Call<UserDto> call, Throwable t) { }
                });
            }

            @Override
            public void onFailure(Call<GetChatByIdResponse> call, Throwable t) { }
        });
    }

    private void connectWs() {
        String token = store.getAccessToken();
        if (token == null || token.isEmpty()) return;
        String base = ApiClient.getBaseUrl(getApplicationContext());
        ws.connect(base, token);
    }

    private void load() {
        b.swipe.setRefreshing(true);
        chatApi.getChatMessages(chatId, 50, null).enqueue(new Callback<GetChatMessagesResponse>() {
            @Override
            public void onResponse(Call<GetChatMessagesResponse> call, Response<GetChatMessagesResponse> resp) {
                b.swipe.setRefreshing(false);
                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(ChatActivity.this, "Messages error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }

                data.clear();
                if (resp.body().messages != null) data.addAll(resp.body().messages);
                adapter.notifyDataSetChanged();
                b.recycler.scrollToPosition(Math.max(0, data.size() - 1));

                if (!firstLoadDone) {
                    firstLoadDone = true;
                    markUnreadAsRead(resp.body().messages);
                }
            }

            @Override
            public void onFailure(Call<GetChatMessagesResponse> call, Throwable t) {
                b.swipe.setRefreshing(false);
                Toast.makeText(ChatActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void sendMessage() {
        String text = b.etInput.getText() == null ? "" : b.etInput.getText().toString().trim();
        if (text.isEmpty()) return;

        boolean ok = ws != null && ws.isConnected() && ws.send(WsOutgoingMessage.text(chatId, text));
        if (!ok) {
            Toast.makeText(this, "WS not connected", Toast.LENGTH_SHORT).show();
            return;
        }

        b.etInput.setText("");

        MessageDto local = new MessageDto();
        local.id = UUID.randomUUID().toString();
        local.chatId = chatId;
        local.senderId = store.getUserId();
        local.content = text;
        local.messageType = "text";
        local.isRead = false;
        local.createdAt = "";
        data.add(local);
        adapter.notifyItemInserted(data.size() - 1);
        b.recycler.scrollToPosition(Math.max(0, data.size() - 1));
    }

    private void markSingleAsReadIfNeeded(MessageDto m) {
        String me = store.getUserId();
        if (me == null || me.isEmpty()) return;
        if (m.id == null || m.id.isEmpty()) return;
        if (m.isRead) return;
        if (me.equals(m.senderId)) return;

        MarkMessagesReadRequest req = MarkMessagesReadRequest.of(chatId, java.util.Collections.singletonList(m.id));
        chatApi.markRead(req).enqueue(new Callback<MarkMessagesReadResponse>() {
            @Override
            public void onResponse(Call<MarkMessagesReadResponse> call, Response<MarkMessagesReadResponse> resp) { }
            @Override
            public void onFailure(Call<MarkMessagesReadResponse> call, Throwable t) { }
        });
    }

    private void markUnreadAsRead(List<MessageDto> messages) {
        if (messages == null || messages.isEmpty()) return;

        String me = store.getUserId();
        if (me == null || me.isEmpty()) return;

        List<String> toRead = new ArrayList<>();
        for (MessageDto m : messages) {
            if (m == null) continue;
            if (m.id == null || m.id.isEmpty()) continue;
            if (m.isRead) continue;
            if (me.equals(m.senderId)) continue;
            toRead.add(m.id);
        }
        if (toRead.isEmpty()) return;

        MarkMessagesReadRequest req = MarkMessagesReadRequest.of(chatId, toRead);
        chatApi.markRead(req).enqueue(new Callback<MarkMessagesReadResponse>() {
            @Override
            public void onResponse(Call<MarkMessagesReadResponse> call, Response<MarkMessagesReadResponse> resp) { }
            @Override
            public void onFailure(Call<MarkMessagesReadResponse> call, Throwable t) { }
        });
    }
}
