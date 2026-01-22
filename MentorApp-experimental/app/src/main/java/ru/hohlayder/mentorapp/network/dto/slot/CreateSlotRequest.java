package ru.hohlayder.mentorapp.network.dto.slot;

import com.google.gson.annotations.SerializedName;

public class CreateSlotRequest {
    @SerializedName("mentor_id")
    public String mentorId;
    @SerializedName("post_id")
    public String postId;
    public String title;
    public String description;
    @SerializedName("start_time")
    public String startTime;
    @SerializedName("duration_minutes")
    public int durationMinutes;
    public long price;
    public String currency;
    public String status;

    public CreateSlotRequest(String mentorId, String postId, String title, String description, String startTime, int durationMinutes, long price, String currency, String status) {
        this.mentorId = mentorId;
        this.postId = postId;
        this.title = title;
        this.description = description;
        this.startTime = startTime;
        this.durationMinutes = durationMinutes;
        this.price = price;
        this.currency = currency;
        this.status = status;
    }
}
