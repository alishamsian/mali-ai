# React Native + Hermes (consumer rules از کتابخانه‌ها هم اعمال می‌شوند)
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

-keepattributes *Annotation*
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

-keepclassmembers class * {
    native <methods>;
}

-dontwarn com.facebook.react.**
