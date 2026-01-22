package ru.hohlayder.mentorapp.network.dto.session;

import com.google.gson.annotations.SerializedName;

public class CreateSessionRequest {
    @SerializedName("slot_id")
    public String slotId;
    @SerializedName("student_id")
    public String studentId;
    @SerializedName("payment_status")
    public String paymentStatus;

    public CreateSessionRequest(String slotId, String studentId, String paymentStatus) {
        this.slotId = slotId;
        this.studentId = studentId;
        this.paymentStatus = paymentStatus;
    }
}