package com.finalpre.quickshare.service.preview;

import java.io.IOException;

public interface PreviewDelivery {

    PreparedPreview open(PreviewSource source, PreviewOptions options) throws IOException;
}
