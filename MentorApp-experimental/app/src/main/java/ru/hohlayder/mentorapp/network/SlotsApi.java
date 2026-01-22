package ru.hohlayder.mentorapp.network;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import ru.hohlayder.mentorapp.network.dto.slot.CreateSlotRequest;
import ru.hohlayder.mentorapp.network.dto.slot.ListSlotsResponse;
import ru.hohlayder.mentorapp.network.dto.slot.SlotDto;
import ru.hohlayder.mentorapp.network.dto.slot.UpdateSlotStatusRequest;

public interface SlotsApi {
    @GET("api/v1/posts/{post_id}/available-slots")
    Call<ListSlotsResponse> getAvailableSlotsByPost(@Path("post_id") String postId);

    @GET("api/v1/posts/{post_id}/slots")
    Call<ListSlotsResponse> getSlotsByPost(@Path("post_id") String postId);

    @POST("api/v1/slots")
    Call<Object> createSlot(@Body CreateSlotRequest req);

    @GET("api/v1/slots/{id}")
    Call<SlotDto> getSlot(@Path("id") String id);

    @POST("api/v1/slots/{id}/status")
    Call<Void> updateSlotStatus(@Path("id") String id, @Body UpdateSlotStatusRequest req);
}
