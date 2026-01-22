package ru.hohlayder.mentorapp.ui.main;

import android.view.LayoutInflater;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

import ru.hohlayder.mentorapp.databinding.ItemManageSlotBinding;
import ru.hohlayder.mentorapp.network.dto.slot.SlotDto;

public class ManageSlotsAdapter extends RecyclerView.Adapter<ManageSlotsAdapter.VH> {

    private final List<SlotDto> items = new ArrayList<>();

    public void setItems(List<SlotDto> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemManageSlotBinding b = ItemManageSlotBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int pos) {
        SlotDto s = items.get(pos);
        h.b.tvTitle.setText(s.title == null ? "" : s.title);
        String meta = (s.startTime == null ? "" : s.startTime) + " | " + s.durationMinutes + " min | " + (s.status == null ? "" : s.status);
        h.b.tvMeta.setText(meta);
        String price = (s.currency == null ? "" : s.currency) + " " + s.price;
        h.b.tvPrice.setText(price);
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        ItemManageSlotBinding b;
        VH(ItemManageSlotBinding b) {
            super(b.getRoot());
            this.b = b;
        }
    }
}
