package com.peterdaily.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetDataPlugin.class);
        super.onCreate(savedInstanceState);
        setSystemBarColors();
    }

    private void setSystemBarColors() {
        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#EFE9DF"));
        window.setNavigationBarColor(Color.parseColor("#EFE9DF"));
        window.getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        );
    }
}
