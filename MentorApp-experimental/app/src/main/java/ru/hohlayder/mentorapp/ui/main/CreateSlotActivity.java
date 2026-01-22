package ru.hohlayder.mentorapp.ui.main;

import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityCreateSlotBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.SlotsApi;
import ru.hohlayder.mentorapp.network.dto.slot.CreateSlotRequest;

public class CreateSlotActivity extends AppCompatActivity {

    private ActivityCreateSlotBinding b;
    private SlotsApi slotsApi;
    private SessionStore store;

    private String postId;
    private boolean busy;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityCreateSlotBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        slotsApi = ApiClient.create(SlotsApi.class);
        store = new SessionStore(getApplicationContext());

        postId = getIntent().getStringExtra("post_id");
        if (postId == null || postId.isEmpty()) {
            finish();
            return;
        }

        b.btnBack.setOnClickListener(v -> finish());
        b.btnCreate.setOnClickListener(v -> create());
        b.etStartTime.setText("2026-01-22T10:00:00Z");
        b.etCurrency.setText("RUB");
    }

    private void setBusy(boolean v) {
        busy = v;
        b.progress.setVisibility(v ? View.VISIBLE : View.GONE);
        b.btnCreate.setEnabled(!v);
        b.btnBack.setEnabled(!v);
    }

    private void create() {
        if (busy) return;

        String mentorId = store.getUserId();
        if (mentorId == null || mentorId.isEmpty()) {
            Toast.makeText(this, "No userId", Toast.LENGTH_SHORT).show();
            return;
        }

        String title = b.etTitle.getText().toString().trim();
        String desc = b.etDescription.getText().toString().trim();
        String start = b.etStartTime.getText().toString().trim();
        String durationS = b.etDuration.getText().toString().trim();
        String priceS = b.etPrice.getText().toString().trim();
        String currency = b.etCurrency.getText().toString().trim();
        String status = b.etStatus.getText().toString().trim();

        if (title.isEmpty() || start.isEmpty() || durationS.isEmpty()) {
            Toast.makeText(this, "Title/start/duration required", Toast.LENGTH_SHORT).show();
            return;
        }

        int duration;
        long price = 0;
        try {
            duration = Integer.parseInt(durationS);
        } catch (Exception e) {
            Toast.makeText(this, "Invalid duration", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!priceS.isEmpty()) {
            try {
                price = Long.parseLong(priceS);
            } catch (Exception e) {
                Toast.makeText(this, "Invalid price", Toast.LENGTH_SHORT).show();
                return;
            }
        }

        if (currency.isEmpty()) currency = "RUB";
        if (status.isEmpty()) status = "available";

        setBusy(true);

        CreateSlotRequest req = new CreateSlotRequest(
                mentorId,
                postId,
                title,
                desc.isEmpty() ? null : desc,
                start,
                duration,
                price,
                currency,
                status
        );

        slotsApi.createSlot(req).enqueue(new Callback<Object>() {
            @Override
            public void onResponse(Call<Object> call, Response<Object> resp) {
                setBusy(false);
                if (!resp.isSuccessful()) {
                    Toast.makeText(CreateSlotActivity.this, "Create slot error: " + resp.code(), Toast.LENGTH_LONG).show();
                    return;
                }
                setResult(RESULT_OK);
                finish();
            }

            @Override
            public void onFailure(Call<Object> call, Throwable t) {
                setBusy(false);
                Toast.makeText(CreateSlotActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
