package ru.hohlayder.mentorapp.network;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import ru.hohlayder.mentorapp.network.dto.session.CreateSessionRequest;
import ru.hohlayder.mentorapp.network.dto.session.CreateSessionResponse;
import ru.hohlayder.mentorapp.network.dto.session.ListSessionsResponse;
import ru.hohlayder.mentorapp.network.dto.session.SessionDto;

public interface SessionsApi {
    @POST("api/v1/sessions")
    Call<CreateSessionResponse> createSession(@Body CreateSessionRequest req);

    @GET("api/v1/students/{student_id}/sessions")
    Call<ListSessionsResponse> listSessionsByStudent(@Path("student_id") String studentId);

    @GET("api/v1/sessions/{id}")
    Call<SessionDto> getSession(@Path("id") String id);
}