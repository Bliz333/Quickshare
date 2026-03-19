package com.finalpre.quickshare.common;

public enum RateLimitScene {
    GUEST_UPLOAD("guest-upload"),
    PUBLIC_SHARE_INFO("public-share-info"),
    PUBLIC_DOWNLOAD("public-download"),
    PUBLIC_SHARE_EXTRACT_CODE_ERROR("public-share-extract-code-error");

    private final String sceneKey;

    RateLimitScene(String sceneKey) {
        this.sceneKey = sceneKey;
    }

    public String getSceneKey() {
        return sceneKey;
    }

    public static RateLimitScene fromKey(String sceneKey) {
        if (sceneKey == null || sceneKey.isBlank()) {
            throw new IllegalArgumentException("频控场景不能为空");
        }

        for (RateLimitScene scene : values()) {
            if (scene.sceneKey.equalsIgnoreCase(sceneKey.trim())) {
                return scene;
            }
        }
        throw new IllegalArgumentException("不支持的频控场景");
    }
}
