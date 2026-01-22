package ru.hohlayder.mentorapp.network.dto.user;

import com.google.gson.annotations.SerializedName;

public class MentorDataDto {
    public String description;

    @SerializedName("withdrawal_address")
    public String withdrawalAddress;
}
