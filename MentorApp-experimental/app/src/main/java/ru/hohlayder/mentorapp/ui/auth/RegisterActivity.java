package ru.hohlayder.mentorapp.ui.auth;

import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityRegisterBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.network.AuthApi;
import ru.hohlayder.mentorapp.network.dto.RegisterRequest;
import ru.hohlayder.mentorapp.network.dto.auth.RegisterResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {
    private ActivityRegisterBinding b;
    private AuthApi authApi;
    private SessionStore store;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityRegisterBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        ApiClient.init(getApplicationContext());
        authApi = ApiClient.create(AuthApi.class);
        store = new SessionStore(getApplicationContext());

        b.btnRegister.setOnClickListener(v -> doRegister());
    }

    private void doRegister() {
        String name = b.etName.getText().toString().trim();
        String surname = b.etSurname.getText().toString().trim();
        String email = b.etEmail.getText().toString().trim();
        String pass = b.etPassword.getText().toString();

        if (name.isEmpty() || surname.isEmpty() || email.isEmpty() || pass.isEmpty()) {
            Toast.makeText(this, "Fill all fields", Toast.LENGTH_SHORT).show();
            return;
        }

        store.setLastEmail(email);

        setLoading(true);
        authApi.register(new RegisterRequest(name, surname, email, pass)).enqueue(new Callback<RegisterResponse>() {
            @Override
            public void onResponse(Call<RegisterResponse> call, Response<RegisterResponse> resp) {
                setLoading(false);
                if (!resp.isSuccessful()) {
                    Toast.makeText(RegisterActivity.this, "Register failed: " + resp.code(), Toast.LENGTH_SHORT).show();
                    return;
                }
                Toast.makeText(RegisterActivity.this, "Registered. Now login.", Toast.LENGTH_SHORT).show();
                finish();
            }

            @Override
            public void onFailure(Call<RegisterResponse> call, Throwable t) {
                setLoading(false);
                Toast.makeText(RegisterActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setLoading(boolean on) {
        b.progress.setVisibility(on ? View.VISIBLE : View.GONE);
        b.btnRegister.setEnabled(!on);
    }
}
