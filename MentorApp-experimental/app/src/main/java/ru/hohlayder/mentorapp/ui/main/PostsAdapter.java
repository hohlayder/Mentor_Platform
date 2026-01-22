package ru.hohlayder.mentorapp.ui.main;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

import ru.hohlayder.mentorapp.databinding.ItemPostBinding;
import ru.hohlayder.mentorapp.network.dto.post.PostDto;
import ru.hohlayder.mentorapp.ui.util.ImageLoader;

public class PostsAdapter extends RecyclerView.Adapter<PostsAdapter.VH> {
    public interface Listener {
        void onClick(PostDto p);
    }

    private final List<PostDto> items = new ArrayList<>();
    private final Listener listener;

    public PostsAdapter(Listener listener) {
        this.listener = listener;
    }

    public void setItems(List<PostDto> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        ItemPostBinding b = ItemPostBinding.inflate(LayoutInflater.from(parent.getContext()), parent, false);
        return new VH(b);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int pos) {
        PostDto p = items.get(pos);
        h.b.tvTitle.setText(p.title == null ? "" : p.title);
        String meta = (p.status == null ? "" : p.status) + " | rating " + p.averageRating + " (" + p.ratingsCount + ")";
        h.b.tvMeta.setText(meta);
        h.b.tvContent.setText(p.content == null ? "" : p.content);

        if (p.avatarUrl != null && !p.avatarUrl.isEmpty()) {
            h.b.ivAvatar.setVisibility(View.VISIBLE);
            ImageLoader.loadPostAvatar(h.itemView.getContext(), h.b.ivAvatar, p.avatarUrl);
        } else {
            h.b.ivAvatar.setVisibility(View.GONE);
            h.b.ivAvatar.setImageDrawable(null);
        }

        h.itemView.setOnClickListener(v -> listener.onClick(p));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        ItemPostBinding b;
        VH(ItemPostBinding b) {
            super(b.getRoot());
            this.b = b;
        }
    }
}
