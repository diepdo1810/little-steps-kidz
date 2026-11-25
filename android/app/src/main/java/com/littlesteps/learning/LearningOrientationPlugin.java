package com.littlesteps.learning;

import android.content.pm.ActivityInfo;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LearningOrientation")
public class LearningOrientationPlugin extends Plugin {
    @PluginMethod
    public void setLearning(PluginCall call) {
        Boolean active = call.getBoolean("active", false);
        int orientation = Boolean.TRUE.equals(active)
            ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        getActivity().setRequestedOrientation(orientation);
        call.resolve();
    }
}
