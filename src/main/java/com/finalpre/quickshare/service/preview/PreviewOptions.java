package com.finalpre.quickshare.service.preview;

import java.time.Duration;
import java.util.Objects;

public record PreviewOptions(Integer maxSize, Duration privateCacheDuration) {

    public PreviewOptions {
        Objects.requireNonNull(privateCacheDuration, "privateCacheDuration");
        if (privateCacheDuration.isNegative()) {
            throw new IllegalArgumentException("privateCacheDuration must not be negative");
        }
    }

    public boolean thumbnailRequested() {
        return maxSize != null && maxSize > 0;
    }

    public String cacheControl() {
        return "private, max-age=" + privateCacheDuration.toSeconds();
    }
}
