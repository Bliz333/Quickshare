package com.finalpre.quickshare.service;

import com.finalpre.quickshare.vo.FileInfoVO;

import java.io.IOException;

public interface OfficePreviewService {

    boolean supports(String fileName, String contentType);

    /**
     * The returned resource must remain readable after the source file is released.
     */
    PreviewResource preparePreview(FileInfoVO fileInfo) throws IOException;
}
