package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.fragment.app.Fragment;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.FragmentProfileBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.AuthApi;
import ru.hohlayder.mentorapp.network.ProfilesApi;
import ru.hohlayder.mentorapp.network.dto.user.ProfileResponse;
import ru.hohlayder.mentorapp.network.dto.user.SkillDto;
import ru.hohlayder.mentorapp.ui.auth.LoginActivity;

public class ProfileFragment extends Fragment {
    private FragmentProfileBinding b;
    private SessionStore store;
    private ProfilesApi profilesApi;
    private AuthApi authApi;
    private ProfileResponse.ProfileDto current;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        b = FragmentProfileBinding.inflate(inflater, container, false);

        ApiClient.init(requireContext().getApplicationContext());
        store = new SessionStore(requireContext().getApplicationContext());
        profilesApi = ApiClient.create(ProfilesApi.class);
        authApi = ApiClient.create(AuthApi.class);

        b.btnEdit.setOnClickListener(v -> startActivity(new Intent(requireContext(), ProfileEditActivity.class)));
        b.btnLogout.setOnClickListener(v -> logout());

        b.swipe.setOnRefreshListener(this::load);

        load();
        return b.getRoot();
    }

    private void logout() {
        authApi.logout().enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> resp) {
                forceLogout();
            }

            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                forceLogout();
            }
        });
    }

    private void forceLogout() {
        store.clear();
        ApiClient.reinit(requireContext().getApplicationContext());
        Intent i = new Intent(requireContext(), LoginActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(i);
        requireActivity().finish();
    }

    private void load() {
        String myId = store.getUserId();
        if (myId == null || myId.isEmpty()) {
            b.swipe.setRefreshing(false);
            Toast.makeText(requireContext(), "No userId", Toast.LENGTH_SHORT).show();
            return;
        }

        b.swipe.setRefreshing(true);
        profilesApi.getProfile(myId).enqueue(new Callback<ProfileResponse>() {
            @Override
            public void onResponse(Call<ProfileResponse> call, Response<ProfileResponse> resp) {
                b.swipe.setRefreshing(false);
                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(requireContext(), "Profile error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }
                current = resp.body().getProfile();
                render();
            }

            @Override
            public void onFailure(Call<ProfileResponse> call, Throwable t) {
                b.swipe.setRefreshing(false);
                Toast.makeText(requireContext(), "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void render() {
        if (current == null || current.user == null) return;

        String name = (current.user.firstName == null ? "" : current.user.firstName) + " " + (current.user.lastName == null ? "" : current.user.lastName);
        b.tvName.setText(name.trim());
        b.tvEmail.setText(current.user.email == null ? "" : current.user.email);

        b.tvMentor.setText(current.mentor == null ? "Mentor: no" : "Mentor: yes");
        b.tvStudent.setText(current.student == null ? "Student: no" : "Student: yes");

        b.tvSkills.setText(formatSkills(current.teachingSkills));
    }

    private String formatSkills(List<SkillDto> list) {
        if (list == null || list.isEmpty()) return "Skills: -";
        List<String> rows = new ArrayList<>();
        for (SkillDto s : list) {
            String n = s.skillName == null ? "" : s.skillName;
            String p = s.proficiencyLevel == null ? "" : s.proficiencyLevel;
            rows.add(n + " (" + p + ", " + s.yearsOfExperience + "y)");
        }
        return "Skills:\n" + joinLines(rows);
    }

    private String joinLines(List<String> lines) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < lines.size(); i++) {
            sb.append(lines.get(i));
            if (i + 1 < lines.size()) sb.append("\n");
        }
        return sb.toString();
    }

    @Override
    public void onResume() {
        super.onResume();
        load();
    }
}
