package ru.hohlayder.mentorapp.network.dto.user;

import com.google.gson.annotations.SerializedName;

public class UploadAvatarResponse {
    @SerializedName("avatar_url")
    public String avatarUrl;
}
