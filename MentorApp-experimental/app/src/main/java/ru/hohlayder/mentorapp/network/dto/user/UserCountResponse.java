package ru.hohlayder.mentorapp.network.dto.user;

import com.google.gson.annotations.SerializedName;

public class UserCountResponse {
    @SerializedName("user_count")
    public int userCount;
}
