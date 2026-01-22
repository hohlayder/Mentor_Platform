package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import java.util.ArrayList;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.databinding.ActivitySlotsManageBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.SlotsApi;
import ru.hohlayder.mentorapp.network.dto.slot.ListSlotsResponse;

public class SlotsManageActivity extends AppCompatActivity {

    private ActivitySlotsManageBinding b;
    private SlotsApi slotsApi;
    private ManageSlotsAdapter adapter;

    private String postId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivitySlotsManageBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        slotsApi = ApiClient.create(SlotsApi.class);

        postId = getIntent().getStringExtra("post_id");
        if (postId == null || postId.isEmpty()) {
            finish();
            return;
        }

        b.btnBack.setOnClickListener(v -> finish());
        b.btnCreate.setOnClickListener(v -> openCreate());

        adapter = new ManageSlotsAdapter();
        b.rv.setLayoutManager(new LinearLayoutManager(this));
        b.rv.setAdapter(adapter);

        b.swipe.setOnRefreshListener(this::load);

        load();
    }

    private void setBusy(boolean v) {
        b.progress.setVisibility(v ? View.VISIBLE : View.GONE);
        b.btnCreate.setEnabled(!v);
        b.swipe.setEnabled(!v);
    }

    private void load() {
        b.tvEmpty.setVisibility(View.GONE);
        b.swipe.setRefreshing(true);

        slotsApi.getSlotsByPost(postId).enqueue(new Callback<ListSlotsResponse>() {
            @Override
            public void onResponse(Call<ListSlotsResponse> call, Response<ListSlotsResponse> resp) {
                b.swipe.setRefreshing(false);
                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(SlotsManageActivity.this, "Slots error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    adapter.setItems(new ArrayList<>());
                    b.tvEmpty.setVisibility(View.VISIBLE);
                    return;
                }
                adapter.setItems(resp.body().slots);
                if (resp.body().slots == null || resp.body().slots.isEmpty()) b.tvEmpty.setVisibility(View.VISIBLE);
            }

            @Override
            public void onFailure(Call<ListSlotsResponse> call, Throwable t) {
                b.swipe.setRefreshing(false);
                Toast.makeText(SlotsManageActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                adapter.setItems(new ArrayList<>());
                b.tvEmpty.setVisibility(View.VISIBLE);
            }
        });
    }

    private void openCreate() {
        Intent i = new Intent(this, CreateSlotActivity.class);
        i.putExtra("post_id", postId);
        startActivityForResult(i, 1001);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 1001 && resultCode == RESULT_OK) load();
    }
}
