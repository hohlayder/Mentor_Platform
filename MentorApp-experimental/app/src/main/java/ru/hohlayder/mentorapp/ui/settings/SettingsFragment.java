package ru.hohlayder.mentorapp.ui.settings;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.fragment.app.Fragment;

import ru.hohlayder.mentorapp.core.ThemeStore;
import ru.hohlayder.mentorapp.databinding.FragmentSettingsBinding;

public class SettingsFragment extends Fragment {
    private FragmentSettingsBinding b;

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        b = FragmentSettingsBinding.inflate(inflater, container, false);

        int mode = ThemeStore.getNightMode(requireContext());
        boolean isDark = mode == AppCompatDelegate.MODE_NIGHT_YES;
        b.switchDark.setChecked(isDark);

        b.switchDark.setOnCheckedChangeListener((buttonView, checked) -> {
            int newMode = checked ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO;
            ThemeStore.setNightMode(requireContext(), newMode);
            AppCompatDelegate.setDefaultNightMode(newMode);
            requireActivity().recreate();
        });

        return b.getRoot();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        b = null;
    }
}
