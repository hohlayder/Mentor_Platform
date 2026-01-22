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
import ru.hohlayder.mentorapp.databinding.ItemSlotBinding;
import ru.hohlayder.mentorapp.network.dto.slot.SlotDto;

public class SlotsAdapter extends RecyclerView.Adapter<SlotsAdapter.VH> {

    public interface Listener {
        void onSelected(SlotDto slot);
    }

    private final List<SlotDto> items = new ArrayList<>();
    private final Listener listener;
    private String selectedId;

    private final SimpleDateFormat inFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
    private final SimpleDateFormat inFmt2 = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", Locale.ROOT);
    private final SimpleDateFormat outFmt = new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.ROOT);

    public SlotsAdapter(Listener listener) {
        this.listener = listener;
        inFmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        inFmt2.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    public void setItems(List<SlotDto> newItems) {
        items.clear();
        if (newItems != null) items.addAll(newItems);
        if (selectedId != null) {
            boolean exists = false;
            for (SlotDto s : items) {
                if (s != null && s.id != null && s.id.equals(selectedId)) { exists = true; break; }
            }
            if (!exists) selectedId = null;
        }
        notifyDataSetChanged();
    }

    public SlotDto getSelected() {
        if (selectedId == null) return null;
        for (SlotDto s : items) {
            if (s != null && s.id != null && s.id.equals(selectedId)) return s;
        }
        return null;
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemSlotBinding b = ItemSlotBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        SlotDto s = items.get(position);
        String title = s.title == null ? "" : s.title;
        String when = formatTime(s.startTime);
        String dur = s.durationMinutes > 0 ? (s.durationMinutes + " min") : "";
        String status = s.status == null ? "" : s.status;
        String price = (s.currency == null ? "" : s.currency) + " " + s.price;

        h.b.tvTitle.setText(title);
        h.b.tvWhen.setText(when);
        h.b.tvMeta.setText(dur + " | " + status + " | " + price);

        boolean checked = s.id != null && s.id.equals(selectedId);
        h.b.cb.setChecked(checked);

        h.b.getRoot().setOnClickListener(v -> select(s));
        h.b.cb.setOnClickListener(v -> select(s));
    }

    private void select(SlotDto s) {
        if (s == null || s.id == null) return;
        selectedId = s.id;
        notifyDataSetChanged();
        if (listener != null) listener.onSelected(s);
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
        ItemSlotBinding b;
        VH(ItemSlotBinding b) {
            super(b.getRoot());
            this.b = b;
        }
    }
}
