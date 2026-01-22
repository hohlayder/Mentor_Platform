package ru.hohlayder.mentorapp.network.dto.post;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class ListPostsResponse {
    @SerializedName("next_page_token")
    public String nextPageToken;
    public List<PostDto> posts;
    @SerializedName("total_count")
    public int totalCount;
}
