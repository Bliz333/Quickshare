package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.service.FileService;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.FileInfoVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FileControllerTest {

    @Mock
    private FileService fileService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FileController controller = new FileController();
        ReflectionTestUtils.setField(controller, "fileService", fileService);
        ReflectionTestUtils.setField(controller, "jwtUtil", jwtUtil);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void getUserFilesShouldUseFolderIdQueryParam() throws Exception {
        FileInfoVO file = new FileInfoVO();
        file.setId(1L);
        file.setParentId(12L);
        file.setFolderId(12L);
        file.setIsFolder(0);

        when(jwtUtil.validateToken("token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(7L);
        when(fileService.getFilesByFolder(12L, 7L)).thenReturn(List.of(file));

        mockMvc.perform(get("/api/files")
                        .param("folderId", "12")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].folderId").value(12));

        verify(fileService).getFilesByFolder(12L, 7L);
    }

    @Test
    void renameFolderShouldDelegateToService() throws Exception {
        when(jwtUtil.validateToken("token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(7L);

        mockMvc.perform(put("/api/folders/15/rename")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newName\":\"docs\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(fileService).renameFolder(15L, "docs", 7L);
    }

    @Test
    void uploadShouldPassFolderIdToService() throws Exception {
        FileInfoVO uploaded = new FileInfoVO();
        uploaded.setId(9L);
        uploaded.setParentId(12L);
        uploaded.setFolderId(12L);

        when(jwtUtil.validateToken("token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(7L);
        when(fileService.uploadFile(any(), eq(7L), eq(12L))).thenReturn(uploaded);

        mockMvc.perform(multipart("/api/upload")
                        .file("file", "demo".getBytes())
                        .param("folderId", "12")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.parentId").value(12))
                .andExpect(jsonPath("$.data.folderId").value(12));

        verify(fileService).uploadFile(any(), eq(7L), eq(12L));
    }
}
