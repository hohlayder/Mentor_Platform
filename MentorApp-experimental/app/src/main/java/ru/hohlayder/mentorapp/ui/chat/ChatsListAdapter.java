package ru.hohlayder.mentorapp.ui.chat;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;

import androidx.annotation.NonNull;
import androidx.collection.LruCache;
import androidx.recyclerview.widget.RecyclerView;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import retrofit2.Call;
import retrofit2.Callback;
import ru.hohlayder.mentorapp.databinding.ItemChatBinding;
import ru.hohlayder.mentorapp.network.UsersApi;
import ru.hohlayder.mentorapp.network.dto.chat.ChatDto;
import ru.hohlayder.mentorapp.network.dto.chat.MessageDto;
import ru.hohlayder.mentorapp.network.dto.user.UserDto;

public class ChatsListAdapter extends RecyclerView.Adapter<ChatsListAdapter.VH> {

    public interface Listener {
        void onChatClick(ChatDto chat);
    }

    private final List<ChatDto> items = new ArrayList<>();
    private final String myUserId;

    private UsersApi usersApi;
    private String baseUrl;

    private Listener listener;

    private final Map<String, UserDto> userCache = new HashMap<>();
    private final OkHttpClient imgClient = new OkHttpClient.Builder().build();
    private final Handler ui = new Handler(Looper.getMainLooper());

    private final LruCache<String, Bitmap> bmpCache;

    private final SimpleDateFormat inUtc = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
    private final SimpleDateFormat outTime = new SimpleDateFormat("HH:mm", Locale.getDefault());
    private final SimpleDateFormat outDate = new SimpleDateFormat("dd.MM", Locale.getDefault());

    public ChatsListAdapter(String myUserId) {
        this.myUserId = myUserId;
        inUtc.setTimeZone(TimeZone.getTimeZone("UTC"));

        int maxKb = (int) (Runtime.getRuntime().maxMemory() / 1024);
        int cacheKb = Math.min(8 * 1024, maxKb / 8);
        bmpCache = new LruCache<String, Bitmap>(cacheKb) {
            @Override
            protected int sizeOf(@NonNull String key, @NonNull Bitmap value) {
                return value.getByteCount() / 1024;
            }
        };
    }

    public void setUsersApi(UsersApi usersApi) {
        this.usersApi = usersApi;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    public void setItems(List<ChatDto> newItems) {
        items.clear();
        if (newItems != null) items.addAll(newItems);

        Collections.sort(items, new Comparator<ChatDto>() {
            @Override
            public int compare(ChatDto a, ChatDto b) {
                long ta = getChatSortTime(a);
                long tb = getChatSortTime(b);
                return Long.compare(tb, ta);
            }
        });

        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemChatBinding b = ItemChatBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        ChatDto c = items.get(position);

        String otherId = getOtherId(c);
        String title = otherId == null || otherId.isEmpty() ? "Chat" : otherId;

        UserDto cached = otherId == null ? null : userCache.get(otherId);
        if (cached != null) {
            title = buildName(cached, otherId);
            bindAvatar(h.b.ivAvatar, resolveAvatarUrl(cached));
        } else {
            h.b.ivAvatar.setImageBitmap(null);
            if (otherId != null && !otherId.isEmpty()) requestUser(otherId);
        }

        h.b.tvTitle.setText(title);

        String preview = buildPreview(c.lastMessage);
        h.b.tvLastMessage.setText(preview);

        String timeStr = formatChatTime(c);
        h.b.tvTime.setText(timeStr);

        if (c.unreadCount > 0) {
            h.b.tvUnread.setText(String.valueOf(c.unreadCount));
            h.b.tvUnread.setVisibility(View.VISIBLE);
        } else {
            h.b.tvUnread.setVisibility(View.GONE);
        }

        h.itemView.setOnClickListener(v -> {
            if (listener != null) listener.onChatClick(c);
        });
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    private String getOtherId(ChatDto c) {
        if (c == null) return "";
        if (myUserId != null && !myUserId.isEmpty()) {
            if (myUserId.equals(c.user1Id)) return c.user2Id;
            if (myUserId.equals(c.user2Id)) return c.user1Id;
        }
        return c.user2Id;
    }

    private String buildName(UserDto u, String fallback) {
        String fn = u.firstName == null ? "" : u.firstName.trim();
        String ln = u.lastName == null ? "" : u.lastName.trim();
        String full = (fn + " " + ln).trim();
        if (!full.isEmpty()) return full;
        if (u.email != null && !u.email.trim().isEmpty()) return u.email.trim();
        return fallback == null ? "User" : fallback;
    }

    private String buildPreview(MessageDto m) {
        if (m == null) return "";
        String text = m.content == null ? "" : m.content.trim();
        if (!text.isEmpty()) return text;
        if (m.attachments != null && !m.attachments.isEmpty()) return "[Attachment]";
        return "";
    }

    private String formatChatTime(ChatDto c) {
        String raw = "";
        if (c != null && c.lastMessage != null && c.lastMessage.createdAt != null) raw = c.lastMessage.createdAt;
        if (raw == null || raw.trim().isEmpty()) {
            if (c != null && c.updatedAt != null) raw = c.updatedAt;
            else if (c != null && c.createdAt != null) raw = c.createdAt;
        }
        long ts = parseIsoUtc(raw);
        if (ts <= 0) return "";

        Date d = new Date(ts);
        if (isToday(ts)) return outTime.format(d);
        return outDate.format(d);
    }

    private long getChatSortTime(ChatDto c) {
        String raw = "";
        if (c != null && c.lastMessage != null && c.lastMessage.createdAt != null) raw = c.lastMessage.createdAt;
        if (raw == null || raw.trim().isEmpty()) {
            if (c != null && c.updatedAt != null) raw = c.updatedAt;
            else if (c != null && c.createdAt != null) raw = c.createdAt;
        }
        return parseIsoUtc(raw);
    }

    private boolean isToday(long ts) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        int y = cal.get(java.util.Calendar.YEAR);
        int m = cal.get(java.util.Calendar.MONTH);
        int d = cal.get(java.util.Calendar.DAY_OF_MONTH);

        cal.setTimeInMillis(ts);
        return cal.get(java.util.Calendar.YEAR) == y
                && cal.get(java.util.Calendar.MONTH) == m
                && cal.get(java.util.Calendar.DAY_OF_MONTH) == d;
    }

    private long parseIsoUtc(String createdAt) {
        if (createdAt == null) return 0;
        String s = createdAt.trim();
        if (s.isEmpty()) return 0;

        if (s.endsWith("Z")) s = s.substring(0, s.length() - 1);
        int dot = s.indexOf('.');
        if (dot > 0) s = s.substring(0, dot);

        try {
            Date d = inUtc.parse(s);
            if (d == null) return 0;
            return d.getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    private void requestUser(String userId) {
        if (usersApi == null) return;
        usersApi.getById(userId).enqueue(new Callback<UserDto>() {
            @Override
            public void onResponse(Call<UserDto> call, retrofit2.Response<UserDto> resp) {
                if (!resp.isSuccessful() || resp.body() == null) return;
                userCache.put(userId, resp.body());
                ui.post(() -> notifyDataSetChanged());
            }

            @Override
            public void onFailure(Call<UserDto> call, Throwable t) { }
        });
    }

    private String resolveAvatarUrl(UserDto u) {
        if (u == null) return "";
        String url = u.avatarUrl == null ? "" : u.avatarUrl.trim();
        if (url.isEmpty()) return "";

        if (url.startsWith("http://") || url.startsWith("https://")) return url;

        String b = baseUrl == null ? "" : baseUrl.trim();
        if (b.isEmpty()) return url;

        if (!b.endsWith("/")) b = b + "/";
        if (url.startsWith("/")) url = url.substring(1);
        return b + url;
    }

    private void bindAvatar(ImageView iv, String url) {
        if (url == null || url.trim().isEmpty()) {
            iv.setImageBitmap(null);
            return;
        }

        Bitmap cached = bmpCache.get(url);
        if (cached != null) {
            iv.setImageBitmap(cached);
            return;
        }

        iv.setImageBitmap(null);

        new Thread(() -> {
            try {
                Request req = new Request.Builder().url(url).get().build();
                Response resp = imgClient.newCall(req).execute();
                if (!resp.isSuccessful() || resp.body() == null) return;

                byte[] bytes = resp.body().bytes();
                Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bmp == null) return;

                bmpCache.put(url, bmp);
                ui.post(() -> iv.setImageBitmap(bmp));
            } catch (IOException ignored) { }
        }).start();
    }

    static class VH extends RecyclerView.ViewHolder {
        final ItemChatBinding b;
        VH(ItemChatBinding b) {
            super(b.getRoot());
            this.b = b;
        }
    }
}
