package ru.hohlayder.mentorapp.ui.chat;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.FragmentChatsBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.ChatApi;
import ru.hohlayder.mentorapp.network.UsersApi;
import ru.hohlayder.mentorapp.network.dto.chat.CreateChatRequest;
import ru.hohlayder.mentorapp.network.dto.chat.CreateChatResponse;
import ru.hohlayder.mentorapp.network.dto.chat.GetUserChatsResponse;
import ru.hohlayder.mentorapp.network.dto.user.UserDto;

public class ChatsFragment extends Fragment {

    private FragmentChatsBinding b;
    private ChatApi chatApi;
    private UsersApi usersApi;
    private SessionStore store;
    private ChatsListAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        b = FragmentChatsBinding.inflate(inflater, container, false);
        return b.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        ApiClient.init(requireContext().getApplicationContext());
        chatApi = ApiClient.create(ChatApi.class);
        usersApi = ApiClient.create(UsersApi.class);
        store = new SessionStore(requireContext().getApplicationContext());

        adapter = new ChatsListAdapter(store.getUserId());
        adapter.setUsersApi(usersApi);
        adapter.setBaseUrl(ApiClient.getBaseUrl(requireContext().getApplicationContext()));
        adapter.setListener(chat -> {
            if (chat == null || chat.id == null || chat.id.isEmpty()) return;
            Intent i = new Intent(requireContext(), ChatActivity.class);
            i.putExtra(ChatActivity.EXTRA_CHAT_ID, chat.id);
            startActivity(i);
        });

        b.recycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        b.recycler.setAdapter(adapter);

        b.swipe.setOnRefreshListener(this::load);
        b.btnNewChat.setOnClickListener(v -> openNewChatDialog());

        load();
    }

    @Override
    public void onResume() {
        super.onResume();
        load();
    }

    private void load() {
        b.swipe.setRefreshing(true);
        chatApi.getUserChats(50, 0).enqueue(new Callback<GetUserChatsResponse>() {
            @Override
            public void onResponse(Call<GetUserChatsResponse> call, Response<GetUserChatsResponse> resp) {
                b.swipe.setRefreshing(false);

                if (!resp.isSuccessful() || resp.body() == null) {
                    b.tvEmpty.setVisibility(View.VISIBLE);
                    adapter.setItems(null);
                    Toast.makeText(requireContext(), "Chats error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }

                adapter.setItems(resp.body().chats);
                boolean empty = resp.body().chats == null || resp.body().chats.isEmpty();
                b.tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
            }

            @Override
            public void onFailure(Call<GetUserChatsResponse> call, Throwable t) {
                b.swipe.setRefreshing(false);
                b.tvEmpty.setVisibility(View.VISIBLE);
                Toast.makeText(requireContext(), "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void openNewChatDialog() {
        EditText et = new EditText(requireContext());
        et.setHint("Email");
        et.setInputType(InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);

        new AlertDialog.Builder(requireContext())
                .setTitle("New chat")
                .setView(et)
                .setPositiveButton("Create", (d, w) -> {
                    String email = et.getText() == null ? "" : et.getText().toString().trim();
                    if (email.isEmpty()) {
                        Toast.makeText(requireContext(), "Email required", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    createChatByEmail(email);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void createChatByEmail(String email) {
        b.swipe.setRefreshing(true);
        usersApi.getByEmail(email).enqueue(new Callback<UserDto>() {
            @Override
            public void onResponse(Call<UserDto> call, Response<UserDto> resp) {
                if (!resp.isSuccessful() || resp.body() == null || resp.body().userId == null || resp.body().userId.isEmpty()) {
                    b.swipe.setRefreshing(false);
                    Toast.makeText(requireContext(), "User not found: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }

                String otherId = resp.body().userId;
                chatApi.createChat(CreateChatRequest.of(otherId)).enqueue(new Callback<CreateChatResponse>() {
                    @Override
                    public void onResponse(Call<CreateChatResponse> call, Response<CreateChatResponse> resp2) {
                        b.swipe.setRefreshing(false);
                        if (!resp2.isSuccessful() || resp2.body() == null || resp2.body().chatId == null || resp2.body().chatId.isEmpty()) {
                            Toast.makeText(requireContext(), "Create chat error: " + resp2.code(), Toast.LENGTH_SHORT).show();
                            return;
                        }
                        Intent i = new Intent(requireContext(), ChatActivity.class);
                        i.putExtra(ChatActivity.EXTRA_CHAT_ID, resp2.body().chatId);
                        startActivity(i);
                    }

                    @Override
                    public void onFailure(Call<CreateChatResponse> call, Throwable t) {
                        b.swipe.setRefreshing(false);
                        Toast.makeText(requireContext(), "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
            }

            @Override
            public void onFailure(Call<UserDto> call, Throwable t) {
                b.swipe.setRefreshing(false);
                Toast.makeText(requireContext(), "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        b = null;
    }
}
