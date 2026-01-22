package ru.hohlayder.mentorapp.network.dto.post;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class UpdatePostRequest {
    public Post post;

    public static class Post {
        public String id;
        public String title;
        public String content;
        public List<String> tags;
        public String status;
        @SerializedName("avatar_url")
        public String avatarUrl;
    }

    public static UpdatePostRequest of(String id, String title, String content, List<String> tags, String status, String avatarUrl) {
        UpdatePostRequest r = new UpdatePostRequest();
        r.post = new Post();
        r.post.id = id;
        r.post.title = title;
        r.post.content = content;
        r.post.tags = tags;
        r.post.status = status;
        r.post.avatarUrl = avatarUrl;
        return r;
    }
}
