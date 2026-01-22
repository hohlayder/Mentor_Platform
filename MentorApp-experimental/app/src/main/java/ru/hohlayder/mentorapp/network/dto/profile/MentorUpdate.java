package ru.hohlayder.mentorapp.network.dto.profile;

import com.google.gson.annotations.SerializedName;

public class MentorUpdate {
    @SerializedName("description")
    public String description;

    @SerializedName("withdrawal_address")
    public String withdrawalAddress;

    public MentorUpdate() {
    }

    public MentorUpdate(String description, String withdrawalAddress) {
        this.description = description;
        this.withdrawalAddress = withdrawalAddress;
    }
}
