package ru.hohlayder.mentorapp.ui.main;

import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.databinding.ActivitySessionDetailsBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.SessionsApi;
import ru.hohlayder.mentorapp.network.SlotsApi;
import ru.hohlayder.mentorapp.network.dto.session.SessionDto;
import ru.hohlayder.mentorapp.network.dto.slot.SlotDto;

public class SessionDetailsActivity extends AppCompatActivity {

    private ActivitySessionDetailsBinding b;
    private SessionsApi sessionsApi;
    private SlotsApi slotsApi;

    private String sessionId;
    private SessionDto session;
    private SlotDto slot;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivitySessionDetailsBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        sessionsApi = ApiClient.create(SessionsApi.class);
        slotsApi = ApiClient.create(SlotsApi.class);

        sessionId = getIntent().getStringExtra("session_id");
        if (sessionId == null || sessionId.isEmpty()) {
            finish();
            return;
        }

        b.btnBack.setOnClickListener(v -> finish());
        loadSession();
    }

    private void setBusy(boolean v) {
        b.progress.setVisibility(v ? View.VISIBLE : View.GONE);
        b.content.setVisibility(v ? View.GONE : View.VISIBLE);
    }

    private void loadSession() {
        setBusy(true);
        sessionsApi.getSession(sessionId).enqueue(new Callback<SessionDto>() {
            @Override
            public void onResponse(Call<SessionDto> call, Response<SessionDto> resp) {
                if (!resp.isSuccessful() || resp.body() == null) {
                    setBusy(false);
                    Toast.makeText(SessionDetailsActivity.this, "Get session error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }
                session = resp.body();
                renderSession();
                loadSlot();
            }

            @Override
            public void onFailure(Call<SessionDto> call, Throwable t) {
                setBusy(false);
                Toast.makeText(SessionDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void loadSlot() {
        if (session == null || session.slotId == null || session.slotId.isEmpty()) {
            setBusy(false);
            return;
        }
        slotsApi.getSlot(session.slotId).enqueue(new Callback<SlotDto>() {
            @Override
            public void onResponse(Call<SlotDto> call, Response<SlotDto> resp) {
                setBusy(false);
                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(SessionDetailsActivity.this, "Get slot error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }
                slot = resp.body();
                renderSlot();
            }

            @Override
            public void onFailure(Call<SlotDto> call, Throwable t) {
                setBusy(false);
                Toast.makeText(SessionDetailsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void renderSession() {
        String title = "Session";
        if (session != null && session.id != null && session.id.length() >= 8) title = "Session " + session.id.substring(0, 8);
        b.tvTitle.setText(title);
        b.tvSessionMeta.setText((session.paymentStatus == null ? "" : session.paymentStatus) + " | slot " + (session.slotId == null ? "" : session.slotId));
        String rr = "";
        if (session.rating != null) rr += "rating " + session.rating;
        if (session.review != null && !session.review.isEmpty()) rr += (rr.isEmpty() ? "" : " | ") + session.review;
        b.tvReview.setText(rr);
    }

    private void renderSlot() {
        if (slot == null) return;
        b.tvSlotTitle.setText(slot.title == null ? "" : slot.title);
        String meta = (slot.startTime == null ? "" : slot.startTime) + " | " + slot.durationMinutes + " min | " + (slot.status == null ? "" : slot.status);
        b.tvSlotMeta.setText(meta);
    }
}
