package ru.hohlayder.mentorapp.network.dto.post;

import java.util.List;

public class CreatePostRequest {
    public String title;
    public String content;
    public List<String> tags;
    public String status;
    public String avatar_url;

    public static CreatePostRequest of(String title, String content, List<String> tags, String status, String avatarUrl) {
        CreatePostRequest r = new CreatePostRequest();
        r.title = title;
        r.content = content;
        r.tags = tags;
        r.status = status;
        r.avatar_url = avatarUrl;
        return r;
    }
}
