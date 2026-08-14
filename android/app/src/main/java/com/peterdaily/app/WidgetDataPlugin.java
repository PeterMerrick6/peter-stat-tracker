package com.peterdaily.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetData")
public class WidgetDataPlugin extends Plugin {
    @PluginMethod
    public void saveSnapshot(PluginCall call) {
        String snapshot = call.getString("snapshot", "");
        WidgetDataStore.saveSnapshot(getContext(), snapshot);
        PeterDailyWidgetProvider.updateAllWidgets(getContext());

        JSObject result = new JSObject();
        result.put("saved", true);
        call.resolve(result);
    }
}
