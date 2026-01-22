package ru.hohlayder.mentorapp.network.dto.user;

import com.google.gson.annotations.SerializedName;

public class UserPublicDto {
    @SerializedName("user_id")
    public String userId;

    @SerializedName("first_name")
    public String firstName;

    @SerializedName("last_name")
    public String lastName;

    public String email;

    @SerializedName("avatar_url")
    public String avatarUrl;

    @SerializedName("created_at")
    public String createdAt;
}
