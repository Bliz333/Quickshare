package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.dto.ShareRequestDTO;
import com.finalpre.quickshare.entity.FileInfo;
import com.finalpre.quickshare.entity.ShareLink;
import com.finalpre.quickshare.mapper.FileInfoMapper;
import com.finalpre.quickshare.mapper.ShareLinkMapper;
import com.finalpre.quickshare.service.FileUploadPolicy;
import com.finalpre.quickshare.service.FileUploadPolicyService;
import com.finalpre.quickshare.vo.FileInfoVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileServiceImplTest {

    @Mock
    private FileInfoMapper fileInfoMapper;

    @Mock
    private ShareLinkMapper shareLinkMapper;

    @Mock
    private FileConfig fileConfig;

    @Mock
    private FileUploadPolicyService fileUploadPolicyService;

    @InjectMocks
    private FileServiceImpl fileService;

    @Test
    void getFilesByFolderShouldExposeFolderIdAlias() {
        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(1L);
        fileInfo.setUserId(7L);
        fileInfo.setOriginalName("demo.txt");
        fileInfo.setFileName("demo.txt");
        fileInfo.setParentId(12L);
        fileInfo.setIsFolder(0);
        fileInfo.setUploadTime(LocalDateTime.of(2026, 3, 18, 12, 0));

        when(fileInfoMapper.selectList(any())).thenReturn(List.of(fileInfo));

        List<FileInfoVO> result = fileService.getFilesByFolder(12L, 7L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getParentId()).isEqualTo(12L);
        assertThat(result.get(0).getFolderId()).isEqualTo(12L);
        assertThat(result.get(0).getCreateTime()).isEqualTo(fileInfo.getUploadTime());
    }

    @Test
    void uploadFileShouldPersistSelectedFolder(@org.junit.jupiter.api.io.TempDir Path tempDir) {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "demo.txt",
                "text/plain",
                "hello".getBytes()
        );

        FileInfo folder = new FileInfo();
        folder.setId(12L);
        folder.setUserId(7L);
        folder.setIsFolder(1);
        folder.setDeleted(0);

        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, -1L, List.of()));
        when(fileConfig.getUploadDir()).thenReturn(tempDir.toString());
        when(fileInfoMapper.selectById(12L)).thenReturn(folder);
        doAnswer(invocation -> {
            FileInfo saved = invocation.getArgument(0);
            saved.setId(99L);
            return 1;
        }).when(fileInfoMapper).insert(any(FileInfo.class));

        FileInfoVO result = fileService.uploadFile(file, 7L, 12L);

        assertThat(result.getId()).isEqualTo(99L);
        assertThat(result.getParentId()).isEqualTo(12L);
        assertThat(result.getFolderId()).isEqualTo(12L);
        assertThat(result.getOriginalName()).isEqualTo("demo.txt");
        assertThat(result.getFilePath()).startsWith(tempDir.toString());
    }

    @Test
    void uploadFileShouldRejectUnsupportedExtensionFromPolicy() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "demo.exe",
                "application/octet-stream",
                "hello".getBytes()
        );

        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, -1L, List.of("pdf", "docx")));

        assertThatThrownBy(() -> fileService.uploadFile(file, 7L, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("不支持的文件类型");
    }

    @Test
    void uploadFileShouldRejectOversizedFileFromPolicy() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "demo.txt",
                "text/plain",
                "hello".getBytes()
        );

        when(fileUploadPolicyService.getPolicy()).thenReturn(new FileUploadPolicy(true, 4L, List.of()));

        assertThatThrownBy(() -> fileService.uploadFile(file, 7L, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("文件大小超过限制");
    }

    @Test
    void deleteFileShouldRemovePhysicalFile(@org.junit.jupiter.api.io.TempDir Path tempDir) throws Exception {
        Path filePath = tempDir.resolve("to-delete.txt");
        java.nio.file.Files.writeString(filePath, "cleanup");

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(5L);
        fileInfo.setUserId(7L);
        fileInfo.setIsFolder(0);
        fileInfo.setFilePath(filePath.toString());

        when(fileInfoMapper.selectById(5L)).thenReturn(fileInfo);

        fileService.deleteFile(5L, 7L);

        assertThat(filePath).doesNotExist();
        verify(fileInfoMapper).deleteById(5L);
    }

    @Test
    void deleteFolderShouldRemoveNestedPhysicalFiles(@org.junit.jupiter.api.io.TempDir Path tempDir) throws Exception {
        Path childFilePath = tempDir.resolve("child.txt");
        java.nio.file.Files.writeString(childFilePath, "nested");

        FileInfo folder = new FileInfo();
        folder.setId(10L);
        folder.setUserId(7L);
        folder.setIsFolder(1);

        FileInfo childFile = new FileInfo();
        childFile.setId(11L);
        childFile.setUserId(7L);
        childFile.setIsFolder(0);
        childFile.setFilePath(childFilePath.toString());

        when(fileInfoMapper.selectById(10L)).thenReturn(folder);
        when(fileInfoMapper.selectList(any())).thenReturn(List.of(childFile));

        fileService.deleteFolder(10L, 7L);

        assertThat(childFilePath).doesNotExist();
        verify(fileInfoMapper).deleteById(11L);
        verify(fileInfoMapper).deleteById(10L);
    }

    @Test
    void renameFileShouldRejectDuplicateNameInSameFolder() {
        FileInfo existing = new FileInfo();
        existing.setId(5L);
        existing.setUserId(7L);
        existing.setParentId(12L);
        existing.setIsFolder(0);
        existing.setDeleted(0);

        when(fileInfoMapper.selectById(5L)).thenReturn(existing);
        when(fileInfoMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> fileService.renameFile(5L, "duplicate.txt", 7L))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("该目录下已存在同名文件或文件夹");
    }

    @Test
    void renameFolderShouldRejectDuplicateNameInSameFolder() {
        FileInfo folder = new FileInfo();
        folder.setId(8L);
        folder.setUserId(7L);
        folder.setParentId(0L);
        folder.setIsFolder(1);
        folder.setDeleted(0);

        when(fileInfoMapper.selectById(8L)).thenReturn(folder);
        when(fileInfoMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> fileService.renameFolder(8L, "docs", 7L))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("该目录下已存在同名文件或文件夹");
    }

    @Test
    void createShareLinkShouldRejectDeletedFile() {
        ShareRequestDTO request = new ShareRequestDTO();
        request.setFileId(5L);

        FileInfo deletedFile = new FileInfo();
        deletedFile.setId(5L);
        deletedFile.setUserId(7L);
        deletedFile.setDeleted(1);

        when(fileInfoMapper.selectById(5L)).thenReturn(deletedFile);

        assertThatThrownBy(() -> fileService.createShareLink(request, 7L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("文件不存在");
    }

    @Test
    void createShareLinkShouldRejectAnotherUsersFile() {
        ShareRequestDTO request = new ShareRequestDTO();
        request.setFileId(5L);

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(5L);
        fileInfo.setUserId(8L);
        fileInfo.setDeleted(0);

        when(fileInfoMapper.selectById(5L)).thenReturn(fileInfo);

        assertThatThrownBy(() -> fileService.createShareLink(request, 7L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("无权分享此文件");
    }

    @Test
    void getShareInfoShouldRejectInvalidExtractCode() {
        ShareLink shareLink = buildShareLink("ABCD1234", "1234");
        when(shareLinkMapper.selectOne(any())).thenReturn(shareLink);

        assertThatThrownBy(() -> fileService.getShareInfo("ABCD1234", "9999"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("提取码错误");
    }

    @Test
    void getShareInfoShouldRejectExpiredLink() {
        ShareLink shareLink = buildShareLink("ABCD1234", "1234");
        shareLink.setExpireTime(LocalDateTime.now().minusMinutes(1));

        when(shareLinkMapper.selectOne(any())).thenReturn(shareLink);

        assertThatThrownBy(() -> fileService.getShareInfo("ABCD1234", "1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("分享链接已过期");
    }

    @Test
    void getShareInfoShouldRejectDownloadLimitReached() {
        ShareLink shareLink = buildShareLink("ABCD1234", "1234");
        shareLink.setMaxDownload(1);
        shareLink.setDownloadCount(1);

        when(shareLinkMapper.selectOne(any())).thenReturn(shareLink);

        assertThatThrownBy(() -> fileService.getShareInfo("ABCD1234", "1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("下载次数已达上限");
    }

    @Test
    void getShareInfoShouldRejectDeletedBackingFile() {
        ShareLink shareLink = buildShareLink("ABCD1234", "1234");
        FileInfo deletedFile = new FileInfo();
        deletedFile.setId(9L);
        deletedFile.setDeleted(1);

        when(shareLinkMapper.selectOne(any())).thenReturn(shareLink);
        when(fileInfoMapper.selectById(9L)).thenReturn(deletedFile);

        assertThatThrownBy(() -> fileService.getShareInfo("ABCD1234", "1234"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("文件不存在或已删除");
    }

    @Test
    void downloadFileShouldStreamFileAndIncreaseDownloadCount(@org.junit.jupiter.api.io.TempDir Path tempDir) throws Exception {
        Path filePath = tempDir.resolve("demo.txt");
        java.nio.file.Files.writeString(filePath, "download-body");

        ShareLink shareLink = buildShareLink("ABCD1234", "1234");

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(9L);
        fileInfo.setDeleted(0);
        fileInfo.setOriginalName("demo.txt");
        fileInfo.setFilePath(filePath.toString());
        fileInfo.setFileSize(java.nio.file.Files.size(filePath));

        when(shareLinkMapper.selectOne(any())).thenReturn(shareLink);
        when(fileInfoMapper.selectById(9L)).thenReturn(fileInfo);
        when(shareLinkMapper.incrementDownloadCount(1L)).thenReturn(1);

        MockHttpServletResponse response = new MockHttpServletResponse();
        fileService.downloadFile("ABCD1234", "1234", response);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getContentAsString()).isEqualTo("download-body");
        assertThat(response.getContentType()).isEqualTo("application/octet-stream");
        assertThat(response.getHeader("Content-Disposition")).contains("demo.txt");

        verify(shareLinkMapper).incrementDownloadCount(1L);
    }

    @Test
    void downloadFileShouldRejectWhenAtomicIncrementFails() {
        ShareLink shareLink = buildShareLink("ABCD1234", "1234");
        shareLink.setMaxDownload(1);
        shareLink.setDownloadCount(0); // fast-fail check passes

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(9L);
        fileInfo.setDeleted(0);
        fileInfo.setOriginalName("demo.txt");

        when(shareLinkMapper.selectOne(any())).thenReturn(shareLink);
        when(fileInfoMapper.selectById(9L)).thenReturn(fileInfo);
        when(shareLinkMapper.incrementDownloadCount(1L)).thenReturn(0); // concurrent limit reached

        MockHttpServletResponse response = new MockHttpServletResponse();
        assertThatThrownBy(() -> fileService.downloadFile("ABCD1234", "1234", response))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("下载次数已达上限");
    }

    private ShareLink buildShareLink(String shareCode, String extractCode) {
        ShareLink shareLink = new ShareLink();
        shareLink.setId(1L);
        shareLink.setFileId(9L);
        shareLink.setShareCode(shareCode);
        shareLink.setExtractCode(extractCode);
        shareLink.setExpireTime(LocalDateTime.now().plusHours(1));
        shareLink.setDownloadCount(0);
        shareLink.setMaxDownload(-1);
        shareLink.setStatus(1);
        return shareLink;
    }
}
