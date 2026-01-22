package ru.hohlayder.mentorapp.network.dto.session;

import com.google.gson.annotations.SerializedName;

public class SessionDto {
    public String id;
    @SerializedName("slot_id")
    public String slotId;
    @SerializedName("student_id")
    public String studentId;
    @SerializedName("payment_status")
    public String paymentStatus;
    public Integer rating;
    public String review;
    @SerializedName("created_at")
    public String createdAt;
    @SerializedName("updated_at")
    public String updatedAt;
}