package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import java.util.ArrayList;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.FragmentSessionsBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.SessionsApi;
import ru.hohlayder.mentorapp.network.dto.session.ListSessionsResponse;

public class SessionsFragment extends Fragment {

    private FragmentSessionsBinding b;
    private SessionsApi sessionsApi;
    private SessionStore store;
    private SessionsAdapter adapter;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        b = FragmentSessionsBinding.inflate(inflater, container, false);

        ApiClient.init(requireContext().getApplicationContext());
        sessionsApi = ApiClient.create(SessionsApi.class);
        store = new SessionStore(requireContext().getApplicationContext());

        adapter = new SessionsAdapter(s -> {
            if (s == null || s.id == null) return;
            Intent i = new Intent(requireContext(), SessionDetailsActivity.class);
            i.putExtra("session_id", s.id);
            startActivity(i);
        });

        b.rv.setLayoutManager(new LinearLayoutManager(requireContext()));
        b.rv.setAdapter(adapter);

        b.swipe.setOnRefreshListener(this::load);

        load();
        return b.getRoot();
    }

    @Override
    public void onResume() {
        super.onResume();
        load();
    }

    private void load() {
        String myId = store.getUserId();
        if (myId == null || myId.isEmpty()) {
            b.swipe.setRefreshing(false);
            adapter.setItems(new ArrayList<>());
            b.tvEmpty.setVisibility(View.VISIBLE);
            return;
        }

        b.tvEmpty.setVisibility(View.GONE);
        b.swipe.setRefreshing(true);

        sessionsApi.listSessionsByStudent(myId).enqueue(new Callback<ListSessionsResponse>() {
            @Override
            public void onResponse(Call<ListSessionsResponse> call, Response<ListSessionsResponse> resp) {
                b.swipe.setRefreshing(false);
                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(requireContext(), "Sessions error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    adapter.setItems(new ArrayList<>());
                    b.tvEmpty.setVisibility(View.VISIBLE);
                    return;
                }
                adapter.setItems(resp.body().sessions);
                if (resp.body().sessions == null || resp.body().sessions.isEmpty()) b.tvEmpty.setVisibility(View.VISIBLE);
            }

            @Override
            public void onFailure(Call<ListSessionsResponse> call, Throwable t) {
                b.swipe.setRefreshing(false);
                Toast.makeText(requireContext(), "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                adapter.setItems(new ArrayList<>());
                b.tvEmpty.setVisibility(View.VISIBLE);
            }
        });
    }
}