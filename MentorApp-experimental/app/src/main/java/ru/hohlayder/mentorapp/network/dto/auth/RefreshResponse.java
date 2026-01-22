package ru.hohlayder.mentorapp.network.dto.auth;

import com.google.gson.annotations.SerializedName;

public class RefreshResponse {
    @SerializedName("refresh_token")
    public String refreshToken;
    @SerializedName("access_token")
    public String accessToken;
}
