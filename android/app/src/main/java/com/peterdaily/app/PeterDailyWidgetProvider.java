package com.peterdaily.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class PeterDailyWidgetProvider extends AppWidgetProvider {
    private static final int MAX_GOALS = 3;
    private static final int DAY_COUNT = 7;
    private static final int[] ROW_IDS = {
        R.id.widget_goal_row_1,
        R.id.widget_goal_row_2,
        R.id.widget_goal_row_3,
    };
    private static final int[] TITLE_IDS = {
        R.id.widget_goal_title_1,
        R.id.widget_goal_title_2,
        R.id.widget_goal_title_3,
    };
    private static final int[] STREAK_IDS = {
        R.id.widget_goal_streak_1,
        R.id.widget_goal_streak_2,
        R.id.widget_goal_streak_3,
    };
    private static final int[][] BOX_IDS = {
        {
            R.id.widget_goal_1_day_1,
            R.id.widget_goal_1_day_2,
            R.id.widget_goal_1_day_3,
            R.id.widget_goal_1_day_4,
            R.id.widget_goal_1_day_5,
            R.id.widget_goal_1_day_6,
            R.id.widget_goal_1_day_7,
        },
        {
            R.id.widget_goal_2_day_1,
            R.id.widget_goal_2_day_2,
            R.id.widget_goal_2_day_3,
            R.id.widget_goal_2_day_4,
            R.id.widget_goal_2_day_5,
            R.id.widget_goal_2_day_6,
            R.id.widget_goal_2_day_7,
        },
        {
            R.id.widget_goal_3_day_1,
            R.id.widget_goal_3_day_2,
            R.id.widget_goal_3_day_3,
            R.id.widget_goal_3_day_4,
            R.id.widget_goal_3_day_5,
            R.id.widget_goal_3_day_6,
            R.id.widget_goal_3_day_7,
        },
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName widget = new ComponentName(context, PeterDailyWidgetProvider.class);
        int[] widgetIds = manager.getAppWidgetIds(widget);

        for (int widgetId : widgetIds) {
            updateWidget(context, manager, widgetId);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.peter_daily_widget);
        views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context));

        String snapshot = WidgetDataStore.getSnapshot(context);
        try {
            JSONObject root = snapshot.isEmpty() ? new JSONObject() : new JSONObject(snapshot);
            JSONArray goals = root.optJSONArray("goals");
            renderGoals(views, goals);
        } catch (JSONException error) {
            renderGoals(views, null);
        }

        manager.updateAppWidget(widgetId, views);
    }

    private static void renderGoals(RemoteViews views, JSONArray goals) {
        int goalCount = goals == null ? 0 : Math.min(goals.length(), MAX_GOALS);
        views.setTextViewText(R.id.widget_empty_text, goalCount == 0 ? "Open Peter-Daily to sync widget goals" : "");
        views.setViewVisibility(R.id.widget_empty_text, goalCount == 0 ? View.VISIBLE : View.GONE);

        for (int row = 0; row < MAX_GOALS; row += 1) {
            if (row >= goalCount) {
                views.setViewVisibility(ROW_IDS[row], View.GONE);
                continue;
            }

            JSONObject goal = goals.optJSONObject(row);
            views.setViewVisibility(ROW_IDS[row], View.VISIBLE);
            views.setTextViewText(TITLE_IDS[row], goal == null ? "" : goal.optString("title", ""));
            views.setTextViewText(STREAK_IDS[row], goal == null ? "0" : String.valueOf(goal.optInt("streak", 0)));

            JSONArray statuses = goal == null ? null : goal.optJSONArray("statuses");
            for (int day = 0; day < DAY_COUNT; day += 1) {
                String status = statuses == null ? "" : statuses.optString(day, "");
                views.setInt(BOX_IDS[row][day], "setBackgroundColor", colorForStatus(status));
            }
        }
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) {
            intent = new Intent(context, MainActivity.class);
        }
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int colorForStatus(String status) {
        if ("minimum".equals(status)) return Color.rgb(244, 201, 93);
        if ("normal".equals(status)) return Color.rgb(61, 127, 107);
        if ("exceeds".equals(status)) return Color.rgb(121, 167, 107);
        if ("logged".equals(status)) return Color.rgb(155, 166, 159);
        return Color.rgb(216, 204, 188);
    }
}
