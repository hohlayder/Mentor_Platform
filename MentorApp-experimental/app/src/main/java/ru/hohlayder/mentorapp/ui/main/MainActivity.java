package ru.hohlayder.mentorapp.ui.main;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import ru.hohlayder.mentorapp.R;
import ru.hohlayder.mentorapp.core.SessionStore;
import ru.hohlayder.mentorapp.databinding.ActivityMainShellBinding;
import ru.hohlayder.mentorapp.network.ApiClient;
import ru.hohlayder.mentorapp.ui.auth.LoginActivity;
import ru.hohlayder.mentorapp.ui.chat.ChatsFragment;
import ru.hohlayder.mentorapp.ui.settings.SettingsFragment;

public class MainActivity extends AppCompatActivity {
    private ActivityMainShellBinding b;
    private SessionStore store;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        b = ActivityMainShellBinding.inflate(getLayoutInflater());
        setContentView(b.getRoot());

        store = new SessionStore(getApplicationContext());
        if (!store.hasSession()) {
            openLogin();
            return;
        }

        if (savedInstanceState == null) {
            replace(new PostsFragment());
        }

        ApiClient.reinit(getApplicationContext());

        b.bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_posts) replace(new PostsFragment());
            else if (id == R.id.nav_chats) replace(new ChatsFragment());
            else if (id == R.id.nav_sessions) replace(new SessionsFragment());
            else if (id == R.id.nav_profile) replace(new ProfileFragment());
            else if (id == R.id.nav_settings) replace(new SettingsFragment());
            return true;
        });
    }

    private void replace(Fragment f) {
        getSupportFragmentManager().beginTransaction().replace(R.id.container, f).commit();
    }

    private void openLogin() {
        Intent i = new Intent(this, LoginActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
        finish();
    }
}
