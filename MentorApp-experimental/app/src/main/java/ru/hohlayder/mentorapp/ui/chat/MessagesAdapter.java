package ru.hohlayder.mentorapp.ui.chat;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

import ru.hohlayder.mentorapp.R;
import ru.hohlayder.mentorapp.databinding.ItemMessageBinding;
import ru.hohlayder.mentorapp.network.dto.chat.MessageDto;

public class MessagesAdapter extends RecyclerView.Adapter<MessagesAdapter.VH> {
    private final List<MessageDto> items;
    private final String myUserId;
    private String otherUserName = "";

    private final SimpleDateFormat inUtc = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
    private final SimpleDateFormat outLocal = new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault());

    public MessagesAdapter(List<MessageDto> items, String myUserId) {
        this.items = items;
        this.myUserId = myUserId;
        inUtc.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    public void setOtherUserName(String name) {
        otherUserName = name == null ? "" : name.trim();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemMessageBinding b = ItemMessageBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        MessageDto m = items.get(position);

        boolean mine = myUserId != null && myUserId.equals(m.senderId);
        String text = m.content == null ? "" : m.content;

        String from;
        if (mine) from = "You";
        else if (otherUserName != null && !otherUserName.isEmpty()) from = otherUserName;
        else from = "User";

        h.b.tvFrom.setText(from);
        h.b.tvContent.setText(text);

        String dt = formatDate(m.createdAt);
        if (dt.isEmpty()) {
            h.b.tvMeta.setVisibility(View.GONE);
        } else {
            h.b.tvMeta.setVisibility(View.VISIBLE);
            h.b.tvMeta.setText(dt);
        }

        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) h.b.bubble.getLayoutParams();
        lp.gravity = mine ? Gravity.END : Gravity.START;
        h.b.bubble.setLayoutParams(lp);
        h.b.bubble.setBackgroundResource(mine ? R.drawable.bg_message_mine : R.drawable.bg_message_other);

        h.b.tvFrom.setVisibility(mine ? View.GONE : View.VISIBLE);
    }

    private String formatDate(String createdAt) {
        if (createdAt == null) return "";
        String s = createdAt.trim();
        if (s.isEmpty()) return "";

        int t = s.indexOf('T');
        if (t < 0) return s;

        if (s.endsWith("Z")) s = s.substring(0, s.length() - 1);
        int dot = s.indexOf('.');
        if (dot > 0) s = s.substring(0, dot);

        try {
            Date d = inUtc.parse(s);
            if (d == null) return "";
            return outLocal.format(d);
        } catch (Exception e) {
            return "";
        }
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        ItemMessageBinding b;
        VH(ItemMessageBinding b) {
            super(b.getRoot());
            this.b = b;
        }
    }
}
