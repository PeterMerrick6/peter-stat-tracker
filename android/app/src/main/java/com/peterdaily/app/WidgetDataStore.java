package com.peterdaily.app;

import android.content.Context;
import android.content.SharedPreferences;

final class WidgetDataStore {
    static final String PREFS_NAME = "PeterDailyWidgetPrefs";
    static final String SNAPSHOT_KEY = "snapshot";

    private WidgetDataStore() {}

    static void saveSnapshot(Context context, String snapshot) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(SNAPSHOT_KEY, snapshot).apply();
    }

    static String getSnapshot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(SNAPSHOT_KEY, "");
    }
}
