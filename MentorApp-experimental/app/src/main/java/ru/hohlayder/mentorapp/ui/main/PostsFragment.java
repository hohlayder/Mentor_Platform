package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import ru.hohlayder.mentorapp.databinding.FragmentCoursesBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.PostApi;
import ru.hohlayder.mentorapp.network.dto.post.ListPostsResponse;
import ru.hohlayder.mentorapp.network.dto.post.PostDto;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PostsFragment extends Fragment {
    private FragmentCoursesBinding b;
    private PostApi postApi;
    private PostsAdapter adapter;

    private boolean sortReady;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        b = FragmentCoursesBinding.inflate(inflater, container, false);

        ApiClient.init(requireContext().getApplicationContext());
        postApi = ApiClient.create(PostApi.class);

        adapter = new PostsAdapter(this::openDetails);
        b.rv.setLayoutManager(new LinearLayoutManager(requireContext()));
        b.rv.setAdapter(adapter);

        b.swipe.setOnRefreshListener(this::load);
        b.btnSearch.setOnClickListener(v -> load());
        b.btnCreate.setOnClickListener(v -> openCreate());

        setupSort();

        load();
        return b.getRoot();
    }

    private void setupSort() {
        String[] items = new String[] {
                "Newest",
                "Oldest",
                "Title A-Z",
                "Title Z-A"
        };
        ArrayAdapter<String> a = new ArrayAdapter<>(requireContext(), android.R.layout.simple_spinner_dropdown_item, items);
        b.spSort.setAdapter(a);
        b.spSort.setSelection(0);
        sortReady = true;

        b.spSort.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (!sortReady) return;
                load();
            }

            @Override
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
    }

    private void load() {
        b.swipe.setRefreshing(true);

        String search = b.etSearch.getText().toString().trim();
        String tags = b.etTags.getText().toString().trim();

        String sortField = "created_at";
        String sortOrder = "desc";

        int pos = b.spSort.getSelectedItemPosition();
        if (pos == 1) { sortField = "created_at"; sortOrder = "asc"; }
        if (pos == 2) { sortField = "title"; sortOrder = "asc"; }
        if (pos == 3) { sortField = "title"; sortOrder = "desc"; }

        String tagsCsv = tags.isEmpty() ? null : tags;

        postApi.listPosts(
                null,
                null,
                tagsCsv,
                search.isEmpty() ? null : search,
                sortField,
                sortOrder,
                50,
                null,
                null,
                null
        ).enqueue(new Callback<ListPostsResponse>() {
            @Override
            public void onResponse(Call<ListPostsResponse> call, Response<ListPostsResponse> resp) {
                b.swipe.setRefreshing(false);
                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(requireContext(), "Posts error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }
                adapter.setItems(resp.body().posts);
            }

            @Override
            public void onFailure(Call<ListPostsResponse> call, Throwable t) {
                b.swipe.setRefreshing(false);
                Toast.makeText(requireContext(), "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void openDetails(PostDto p) {
        Intent i = new Intent(requireContext(), CourseDetailsActivity.class);
        i.putExtra("post_id", p.id);
        startActivity(i);
    }

    private void openCreate() {
        Intent i = new Intent(requireContext(), CourseEditorActivity.class);
        i.putExtra("mode", "create");
        startActivity(i);
    }
}
