package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.config.FileConfig;
import com.finalpre.quickshare.entity.FileInfo;
import com.finalpre.quickshare.mapper.FileInfoMapper;
import com.finalpre.quickshare.mapper.ShareLinkMapper;
import com.finalpre.quickshare.vo.FileInfoVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileServiceImplTest {

    @Mock
    private FileInfoMapper fileInfoMapper;

    @Mock
    private ShareLinkMapper shareLinkMapper;

    @Mock
    private FileConfig fileConfig;

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

        when(fileConfig.getAllowedTypes()).thenReturn(List.of());
        when(fileConfig.getMaxFileSize()).thenReturn(-1L);
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
}
