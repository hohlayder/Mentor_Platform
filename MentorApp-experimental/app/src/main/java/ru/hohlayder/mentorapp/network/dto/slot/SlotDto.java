package ru.hohlayder.mentorapp.network.dto.slot;

import com.google.gson.annotations.SerializedName;

public class SlotDto {
    public String id;
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
    @SerializedName("created_at")
    public String createdAt;
    @SerializedName("updated_at")
    public String updatedAt;
}