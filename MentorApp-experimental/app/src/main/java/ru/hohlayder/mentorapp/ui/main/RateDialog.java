package ru.hohlayder.mentorapp.ui.main;

import android.content.Context;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.NumberPicker;

import androidx.appcompat.app.AlertDialog;

public class RateDialog {
    public interface Listener {
        void onSubmit(int value, String comment);
    }

    public static void show(Context ctx, Listener l) {
        LinearLayout root = new LinearLayout(ctx);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = (int)(16 * ctx.getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad, pad, pad);

        NumberPicker np = new NumberPicker(ctx);
        np.setMinValue(1);
        np.setMaxValue(5);

        EditText et = new EditText(ctx);
        et.setHint("Comment (optional)");

        root.addView(np);
        root.addView(et);

        new AlertDialog.Builder(ctx)
                .setTitle("Rate")
                .setView(root)
                .setPositiveButton("Send", (d, w) -> l.onSubmit(np.getValue(), et.getText().toString().trim()))
                .setNegativeButton("Cancel", null)
                .show();
    }
}
