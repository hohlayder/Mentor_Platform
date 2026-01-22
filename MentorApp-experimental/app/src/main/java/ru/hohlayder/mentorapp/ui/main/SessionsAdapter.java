package ru.hohlayder.mentorapp.ui.main;

import android.view.LayoutInflater;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import ru.hohlayder.mentorapp.databinding.ItemSessionBinding;
import ru.hohlayder.mentorapp.network.dto.session.SessionDto;

public class SessionsAdapter extends RecyclerView.Adapter<SessionsAdapter.VH> {

    public interface Listener {
        void onClick(SessionDto s);
    }

    private final List<SessionDto> items = new ArrayList<>();
    private final Listener listener;

    private final SimpleDateFormat inFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
    private final SimpleDateFormat inFmt2 = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", Locale.ROOT);
    private final SimpleDateFormat outFmt = new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.ROOT);

    public SessionsAdapter(Listener listener) {
        this.listener = listener;
        inFmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        inFmt2.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    public void setItems(List<SessionDto> newItems) {
        items.clear();
        if (newItems != null) items.addAll(newItems);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemSessionBinding b = ItemSessionBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        SessionDto s = items.get(position);
        String id = s.id == null ? "" : s.id;
        String when = formatTime(s.createdAt);
        String status = s.paymentStatus == null ? "" : s.paymentStatus;
        String rating = s.rating == null ? "" : ("rating " + s.rating);

        h.b.tvTitle.setText("Session " + shortId(id));
        h.b.tvMeta.setText(when + " | " + status + (rating.isEmpty() ? "" : (" | " + rating)));

        h.b.getRoot().setOnClickListener(v -> {
            if (listener != null) listener.onClick(s);
        });
    }

    private String shortId(String id) {
        if (id == null) return "";
        if (id.length() <= 8) return id;
        return id.substring(0, 8);
    }

    private String formatTime(String raw) {
        if (raw == null) return "";
        String v = raw;
        int p = v.indexOf('Z');
        if (p > 0) v = v.substring(0, p);
        try {
            return outFmt.format(inFmt.parse(v));
        } catch (ParseException e) {
            try {
                return outFmt.format(inFmt2.parse(v));
            } catch (ParseException ex) {
                return raw;
            }
        }
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        ItemSessionBinding b;
        VH(ItemSessionBinding b) {
            super(b.getRoot());
            this.b = b;
        }
    }
}