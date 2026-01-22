package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityEnrollBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.SessionsApi;
import ru.hohlayder.mentorapp.network.SlotsApi;
import ru.hohlayder.mentorapp.network.dto.session.CreateSessionRequest;
import ru.hohlayder.mentorapp.network.dto.session.CreateSessionResponse;
import ru.hohlayder.mentorapp.network.dto.slot.ListSlotsResponse;
import ru.hohlayder.mentorapp.network.dto.slot.SlotDto;
import ru.hohlayder.mentorapp.network.dto.slot.UpdateSlotStatusRequest;

public class EnrollActivity extends AppCompatActivity {

    private ActivityEnrollBinding b;
    private SlotsApi slotsApi;
    private SessionsApi sessionsApi;
    private SessionStore store;
    private SlotsAdapter adapter;

    private String postId;
    private boolean busy;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityEnrollBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        slotsApi = ApiClient.create(SlotsApi.class);
        sessionsApi = ApiClient.create(SessionsApi.class);
        store = new SessionStore(getApplicationContext());

        postId = getIntent().getStringExtra("post_id");
        if (postId == null || postId.isEmpty()) {
            finish();
            return;
        }

        adapter = new SlotsAdapter(slot -> updateConfirmState());
        b.rv.setLayoutManager(new LinearLayoutManager(this));
        b.rv.setAdapter(adapter);

        b.swipe.setOnRefreshListener(this::loadSlots);

        b.btnConfirm.setOnClickListener(v -> confirm());

        updateConfirmState();
        loadSlots();
    }

    private void updateConfirmState() {
        boolean has = adapter.getSelected() != null;
        b.btnConfirm.setEnabled(has && !busy);
    }

    private void setBusy(boolean v) {
        busy = v;
        b.progress.setVisibility(v ? View.VISIBLE : View.GONE);
        b.btnConfirm.setEnabled(!v && adapter.getSelected() != null);
        b.swipe.setEnabled(!v);
    }

    private void loadSlots() {
        b.tvEmpty.setVisibility(View.GONE);
        slotsApi.getAvailableSlotsByPost(postId).enqueue(new Callback<ListSlotsResponse>() {
            @Override
            public void onResponse(Call<ListSlotsResponse> call, Response<ListSlotsResponse> resp) {
                b.swipe.setRefreshing(false);
                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(EnrollActivity.this, "Slots error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    adapter.setItems(new ArrayList<>());
                    b.tvEmpty.setVisibility(View.VISIBLE);
                    return;
                }
                List<SlotDto> slots = resp.body().slots;
                adapter.setItems(slots);
                if (slots == null || slots.isEmpty()) b.tvEmpty.setVisibility(View.VISIBLE);
                updateConfirmState();
            }

            @Override
            public void onFailure(Call<ListSlotsResponse> call, Throwable t) {
                b.swipe.setRefreshing(false);
                Toast.makeText(EnrollActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                adapter.setItems(new ArrayList<>());
                b.tvEmpty.setVisibility(View.VISIBLE);
                updateConfirmState();
            }
        });
    }

    private void confirm() {
        SlotDto sel = adapter.getSelected();
        String studentId = store.getUserId();
        if (sel == null || sel.id == null) return;
        if (studentId == null || studentId.isEmpty()) {
            Toast.makeText(this, "No userId", Toast.LENGTH_SHORT).show();
            return;
        }

        new AlertDialog.Builder(this)
                .setTitle("Confirm")
                .setMessage("Book selected slot?")
                .setPositiveButton("Yes", (d, w) -> book(sel.id, studentId))
                .setNegativeButton("No", null)
                .show();
    }

    private void book(String slotId, String studentId) {
        setBusy(true);

        slotsApi.updateSlotStatus(slotId, new UpdateSlotStatusRequest("booked")).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> resp) {
                if (!resp.isSuccessful()) {
                    setBusy(false);
                    String m = resp.code() == 409 ? "Slot already booked" : ("Book error: " + resp.code());
                    Toast.makeText(EnrollActivity.this, m, Toast.LENGTH_SHORT).show();
                    loadSlots();
                    return;
                }
                createSession(slotId, studentId);
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                setBusy(false);
                Toast.makeText(EnrollActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void createSession(String slotId, String studentId) {
        sessionsApi.createSession(new CreateSessionRequest(slotId, studentId, "pending")).enqueue(new Callback<CreateSessionResponse>() {
            @Override
            public void onResponse(Call<CreateSessionResponse> call, Response<CreateSessionResponse> resp) {
                if (!resp.isSuccessful() || resp.body() == null || resp.body().sessionId == null) {
                    rollback(slotId);
                    String m = resp.code() == 409 ? "Slot already booked" : ("Create session error: " + resp.code());
                    Toast.makeText(EnrollActivity.this, m, Toast.LENGTH_SHORT).show();
                    return;
                }
                setBusy(false);
                String sessionId = resp.body().sessionId;
                Toast.makeText(EnrollActivity.this, "Booked", Toast.LENGTH_SHORT).show();
                Intent i = new Intent(EnrollActivity.this, SessionDetailsActivity.class);
                i.putExtra("session_id", sessionId);
                startActivity(i);
                finish();
            }

            @Override
            public void onFailure(Call<CreateSessionResponse> call, Throwable t) {
                rollback(slotId);
                Toast.makeText(EnrollActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void rollback(String slotId) {
        slotsApi.updateSlotStatus(slotId, new UpdateSlotStatusRequest("available")).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> resp) {
                setBusy(false);
                loadSlots();
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                setBusy(false);
                loadSlots();
            }
        });
    }
}