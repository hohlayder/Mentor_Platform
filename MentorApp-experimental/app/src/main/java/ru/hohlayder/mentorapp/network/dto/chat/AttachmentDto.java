package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;

public class AttachmentDto {
    public String id;
    public String url;

    @SerializedName("file_name")
    public String fileName;

    @SerializedName("mime_type")
    public String mimeType;

    @SerializedName("file_size")
    public long fileSize;

    public int width;
    public int height;

    @SerializedName("created_at")
    public String createdAt;
}
