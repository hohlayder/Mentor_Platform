package ru.hohlayder.mentorapp.network.dto.auth;

import com.google.gson.annotations.SerializedName;

public class LoginResponse {
    @SerializedName("access_token")
    public String accessToken;
    @SerializedName("refresh_token")
    public String refreshToken;
    @SerializedName("expires_in")
    public long expiresIn;
}
