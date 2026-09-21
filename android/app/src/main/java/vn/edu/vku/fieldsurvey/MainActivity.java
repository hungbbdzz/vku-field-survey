package vn.edu.vku.fieldsurvey;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0f172a"));
        window.setNavigationBarColor(Color.parseColor("#0f172a"));

        // Enforce standard hardware safe zone at OS level (identical to Facebook, Messenger, YouTube)
        WindowCompat.setDecorFitsSystemWindows(window, true);
    }
}
