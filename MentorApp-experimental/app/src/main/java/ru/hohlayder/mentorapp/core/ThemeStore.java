package ru.hohlayder.mentorapp.core;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.appcompat.app.AppCompatDelegate;

public class ThemeStore {
    private static final String PREFS = "mentor_prefs";
    private static final String KEY_MODE = "night_mode";

    public static int getNightMode(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return p.getInt(KEY_MODE, AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
    }

    public static void setNightMode(Context c, int mode) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit().putInt(KEY_MODE, mode).apply();
    }

    public static void apply(Context c) {
        AppCompatDelegate.setDefaultNightMode(getNightMode(c));
    }
}
