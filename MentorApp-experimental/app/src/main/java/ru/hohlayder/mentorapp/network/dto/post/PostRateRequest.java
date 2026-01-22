package ru.hohlayder.mentorapp.network.dto.post;

import com.google.gson.annotations.SerializedName;

public class PostRateRequest {
    public int rate;
    @SerializedName("user_id")
    public String userId;
    public String comment;

    public PostRateRequest(int rate, String userId, String comment) {
        this.rate = rate;
        this.userId = userId;
        this.comment = comment;
    }
}
