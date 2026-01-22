package ru.hohlayder.mentorapp;

import android.app.Application;

import ru.hohlayder.mentorapp.core.ThemeStore;

public class MentorApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        ThemeStore.apply(getApplicationContext());
    }
}
