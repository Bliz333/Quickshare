package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.entity.TransferPublicShare;
import com.finalpre.quickshare.entity.TransferRelay;
import com.finalpre.quickshare.service.TransferPairingService;
import com.finalpre.quickshare.service.TransferService;
import com.finalpre.quickshare.service.preview.PreparedPreview;
import com.finalpre.quickshare.service.preview.PreviewDelivery;
import com.finalpre.quickshare.service.preview.PreviewOptions;
import com.finalpre.quickshare.service.preview.PreviewSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransferPreviewControllerTest {

    @Mock
    private TransferService transferService;

    @Mock
    private TransferPairingService transferPairingService;

    @Mock
    private PreviewDelivery previewDelivery;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private TransferController transferController;

    @InjectMocks
    private PublicTransferController publicTransferController;

    @Test
    void transferPreviewUsesLocalSourceAndFiveMinuteCache() throws Exception {
        TransferRelay transfer = new TransferRelay();
        transfer.setAssembledPath(Path.of("assembled", "relay.txt").toString());
        transfer.setFileName("relay.txt");
        transfer.setContentType("text/plain");
        transfer.setFileSize(4L);
        when(authentication.getPrincipal()).thenReturn(7L);
        when(transferService.openPreview(7L, 11L, "device-1")).thenReturn(transfer);
        when(previewDelivery.open(any(), any())).thenReturn(prepared("relay"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        transferController.previewTransfer(authentication, 11L, "device-1", 320, response);

        ArgumentCaptor<PreviewSource> sourceCaptor = ArgumentCaptor.forClass(PreviewSource.class);
        ArgumentCaptor<PreviewOptions> optionsCaptor = ArgumentCaptor.forClass(PreviewOptions.class);
        verify(previewDelivery).open(sourceCaptor.capture(), optionsCaptor.capture());
        assertThat(sourceCaptor.getValue().fileName()).isEqualTo("relay.txt");
        assertThat(sourceCaptor.getValue().contentType()).isEqualTo("text/plain");
        assertThat(optionsCaptor.getValue().maxSize()).isEqualTo(320);
        assertThat(optionsCaptor.getValue().cacheControl()).isEqualTo("private, max-age=300");
        assertThat(response.getContentAsString()).isEqualTo("relay");
    }

    @Test
    void publicSharePreviewUsesLocalSourceAndFiveMinuteCache() throws Exception {
        TransferPublicShare share = new TransferPublicShare();
        share.setAssembledPath(Path.of("assembled", "public.txt").toString());
        share.setFileName("public.txt");
        share.setContentType("text/plain");
        share.setFileSize(6L);
        when(transferService.openPublicSharePreview("share-token")).thenReturn(share);
        when(previewDelivery.open(any(), any())).thenReturn(prepared("public"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        publicTransferController.previewShare("share-token", null, response);

        ArgumentCaptor<PreviewSource> sourceCaptor = ArgumentCaptor.forClass(PreviewSource.class);
        ArgumentCaptor<PreviewOptions> optionsCaptor = ArgumentCaptor.forClass(PreviewOptions.class);
        verify(previewDelivery).open(sourceCaptor.capture(), optionsCaptor.capture());
        assertThat(sourceCaptor.getValue().fileName()).isEqualTo("public.txt");
        assertThat(optionsCaptor.getValue().cacheControl()).isEqualTo("private, max-age=300");
        assertThat(response.getContentAsString()).isEqualTo("public");
    }

    private PreparedPreview prepared(String body) {
        byte[] bytes = body.getBytes();
        return new PreparedPreview(
                "preview.txt", "text/plain", bytes.length, "private, max-age=300",
                new ByteArrayInputStream(bytes));
    }
}
