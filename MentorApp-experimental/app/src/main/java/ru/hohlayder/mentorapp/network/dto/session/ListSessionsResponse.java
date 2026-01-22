package ru.hohlayder.mentorapp.network.dto.session;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class ListSessionsResponse {
    public List<SessionDto> sessions;
    public long total;
}