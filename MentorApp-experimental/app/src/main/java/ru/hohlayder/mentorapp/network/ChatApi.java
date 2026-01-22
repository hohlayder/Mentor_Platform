package ru.hohlayder.mentorapp.network;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;
import ru.hohlayder.mentorapp.network.dto.chat.CreateChatRequest;
import ru.hohlayder.mentorapp.network.dto.chat.CreateChatResponse;
import ru.hohlayder.mentorapp.network.dto.chat.GetChatByIdResponse;
import ru.hohlayder.mentorapp.network.dto.chat.GetChatMessagesResponse;
import ru.hohlayder.mentorapp.network.dto.chat.GetUserChatsResponse;
import ru.hohlayder.mentorapp.network.dto.chat.MarkMessagesReadRequest;
import ru.hohlayder.mentorapp.network.dto.chat.MarkMessagesReadResponse;

public interface ChatApi {

    @GET("api/v1/chats")
    Call<GetUserChatsResponse> getUserChats(
            @Query("limit") Integer limit,
            @Query("offset") Integer offset
    );

    @POST("api/v1/chats")
    Call<CreateChatResponse> createChat(@Body CreateChatRequest req);

    @GET("api/v1/chats/{id}")
    Call<GetChatByIdResponse> getChatById(@Path("id") String id);

    @GET("api/v1/chats/messages")
    Call<GetChatMessagesResponse> getChatMessages(
            @Query("chat_id") String chatId,
            @Query("limit") Integer limit,
            @Query("cursor") String cursor
    );

    @POST("api/v1/chats/messages/read")
    Call<MarkMessagesReadResponse> markRead(@Body MarkMessagesReadRequest req);
}
