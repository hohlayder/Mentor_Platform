package ru.hohlayder.mentorapp.network.dto.chat;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class GetChatMessagesResponse {
    public List<MessageDto> messages;

    @SerializedName("next_cursor")
    public CursorDto nextCursor;

    @SerializedName("has_more")
    public boolean hasMore;
}
