package ru.hohlayder.mentorapp.network.dto.post;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class PostDto {
    public String id;
    @SerializedName("author_id")
    public String authorId;
    public String title;
    public String content;
    public List<String> tags;
    public String status;
    @SerializedName("avatar_url")
    public String avatarUrl;
    @SerializedName("average_rating")
    public double averageRating;
    @SerializedName("ratings_count")
    public int ratingsCount;
    @SerializedName("created_at")
    public String createdAt;
    @SerializedName("updated_at")
    public String updatedAt;
}
