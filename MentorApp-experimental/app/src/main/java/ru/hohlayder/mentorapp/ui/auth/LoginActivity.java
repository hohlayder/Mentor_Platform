package ru.hohlayder.mentorapp.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityLoginBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.AuthApi;
import ru.hohlayder.mentorapp.network.dto.auth.LoginRequest;
import ru.hohlayder.mentorapp.network.dto.auth.LoginResponse;
import ru.hohlayder.mentorapp.ui.main.MainActivity;

public class LoginActivity extends AppCompatActivity {

    private ActivityLoginBinding b;
    private AuthApi authApi;
    private SessionStore store;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        authApi = ApiClient.create(AuthApi.class);
        store = new SessionStore(getApplicationContext());

        if (store.hasSession()) {
            openMain();
            return;
        }

        String lastEmail = store.getLastEmail();
        if (lastEmail != null && !lastEmail.isEmpty()) {
            b.etEmail.setText(lastEmail);
        }

        b.btnLogin.setOnClickListener(v -> login());
        wireRegisterButton();
    }

    private void openMain() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(i);
        finish();
    }

    private void wireRegisterButton() {
        View v = findFirstExistingView(
                "btnRegister",
                "btnOpenRegister",
                "btn_register",
                "btn_open_register",
                "tvRegister",
                "tvOpenRegister",
                "tv_register",
                "tv_open_register",
                "linkRegister",
                "link_register"
        );
        if (v == null) return;

        v.setOnClickListener(x -> {
            try {
                startActivity(new Intent(LoginActivity.this, RegisterActivity.class));
            } catch (Exception e) {
                Toast.makeText(LoginActivity.this, "Register screen not found", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private View findFirstExistingView(String... ids) {
        for (String idName : ids) {
            int id = getResources().getIdentifier(idName, "id", getPackageName());
            if (id != 0) {
                View v = findViewById(id);
                if (v != null) return v;
            }
        }
        return null;
    }

    private void login() {
        String email = b.etEmail.getText() == null ? "" : b.etEmail.getText().toString().trim();
        String password = b.etPassword.getText() == null ? "" : b.etPassword.getText().toString();

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Email and password required", Toast.LENGTH_SHORT).show();
            return;
        }

        b.progress.setVisibility(View.VISIBLE);

        authApi.login(new LoginRequest(email, password)).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> resp) {
                b.progress.setVisibility(View.GONE);

                if (!resp.isSuccessful() || resp.body() == null) {
                    Toast.makeText(LoginActivity.this, "Login error: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }

                LoginResponse r = resp.body();
                if (r.accessToken == null || r.refreshToken == null || r.accessToken.isEmpty() || r.refreshToken.isEmpty()) {
                    Toast.makeText(LoginActivity.this, "Invalid login response", Toast.LENGTH_SHORT).show();
                    return;
                }

                store.setLastEmail(email);
                store.setAccessToken(r.accessToken);
                store.setRefreshToken(r.refreshToken);

                ApiClient.reinit(getApplicationContext());
                openMain();
            }

            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                b.progress.setVisibility(View.GONE);
                Toast.makeText(LoginActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
