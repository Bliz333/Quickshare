package com.finalpre.quickshare.common;

public class PreviewUnavailableException extends RuntimeException {

    public PreviewUnavailableException(String message) {
        super(message);
    }

    public PreviewUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
