package com.finalpre.quickshare.service.impl;

import com.finalpre.quickshare.common.ResourceNotFoundException;
import com.finalpre.quickshare.dto.AdminCreateUserRequest;
import com.finalpre.quickshare.entity.FileInfo;
import com.finalpre.quickshare.entity.ShareLink;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.FileInfoMapper;
import com.finalpre.quickshare.mapper.ShareLinkMapper;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.vo.AdminOverviewVO;
import com.finalpre.quickshare.vo.AdminShareVO;
import com.finalpre.quickshare.vo.UserVO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceImplTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private FileInfoMapper fileInfoMapper;

    @Mock
    private ShareLinkMapper shareLinkMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminServiceImpl adminService;

    @Test
    void getOverviewShouldAggregateCounts() {
        FileInfo fileA = new FileInfo();
        fileA.setFileSize(10L);
        FileInfo fileB = new FileInfo();
        fileB.setFileSize(20L);

        when(userMapper.selectCount(any())).thenReturn(3L);
        when(fileInfoMapper.selectCount(any())).thenReturn(5L, 2L);
        when(shareLinkMapper.selectCount(any())).thenReturn(4L, 3L);
        when(fileInfoMapper.selectList(any())).thenReturn(List.of(fileA, fileB));

        AdminOverviewVO overview = adminService.getOverview();

        assertThat(overview.getUserCount()).isEqualTo(3L);
        assertThat(overview.getFileCount()).isEqualTo(5L);
        assertThat(overview.getFolderCount()).isEqualTo(2L);
        assertThat(overview.getShareCount()).isEqualTo(4L);
        assertThat(overview.getActiveShareCount()).isEqualTo(3L);
        assertThat(overview.getTotalStorageBytes()).isEqualTo(30L);
    }

    @Test
    void getUsersShouldExposeNormalizedRole() {
        User admin = new User();
        admin.setId(1L);
        admin.setUsername("root");
        admin.setRole("admin");

        when(userMapper.selectList(any())).thenReturn(List.of(admin));

        List<UserVO> users = adminService.getUsers();

        assertThat(users).hasSize(1);
        assertThat(users.get(0).getRole()).isEqualTo("ADMIN");
        assertThat(users.get(0).getToken()).isNull();
    }

    @Test
    void createUserShouldPersistEncodedPasswordAndNormalizedRole() {
        AdminCreateUserRequest request = new AdminCreateUserRequest();
        request.setUsername("alice");
        request.setPassword("secret123");
        request.setEmail("alice@example.com");
        request.setRole("admin");

        when(userMapper.selectCount(any())).thenReturn(0L);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded-secret");

        adminService.createUser(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        assertThat(captor.getValue().getUsername()).isEqualTo("alice");
        assertThat(captor.getValue().getPassword()).isEqualTo("encoded-secret");
        assertThat(captor.getValue().getRole()).isEqualTo("ADMIN");
        assertThat(captor.getValue().getNickname()).isEqualTo("alice");
    }

    @Test
    void getSharesShouldAttachFileAndUserMetadata() {
        ShareLink share = new ShareLink();
        share.setId(6L);
        share.setFileId(9L);
        share.setShareCode("ABCD1234");
        share.setCreateTime(LocalDateTime.now());
        share.setStatus(1);

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(9L);
        fileInfo.setUserId(3L);
        fileInfo.setOriginalName("demo.txt");

        User user = new User();
        user.setId(3L);
        user.setUsername("alice");

        when(shareLinkMapper.selectList(any())).thenReturn(List.of(share));
        when(fileInfoMapper.selectList(any())).thenReturn(List.of(fileInfo));
        when(userMapper.selectList(any())).thenReturn(List.of(user));

        List<AdminShareVO> shares = adminService.getShares();

        assertThat(shares).hasSize(1);
        assertThat(shares.get(0).getFileName()).isEqualTo("demo.txt");
        assertThat(shares.get(0).getUserId()).isEqualTo(3L);
        assertThat(shares.get(0).getUsername()).isEqualTo("alice");
    }

    @Test
    void updateUserRoleShouldPersistNormalizedRole() {
        User user = new User();
        user.setId(5L);
        user.setRole("USER");

        when(userMapper.selectById(5L)).thenReturn(user);

        adminService.updateUserRole(5L, "admin");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).updateById(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo("ADMIN");
    }

    @Test
    void updateUserRoleShouldRejectDemotingLastAdmin() {
        User admin = new User();
        admin.setId(5L);
        admin.setRole("ADMIN");

        when(userMapper.selectById(5L)).thenReturn(admin);
        when(userMapper.selectList(any())).thenReturn(List.of(admin));

        assertThatThrownBy(() -> adminService.updateUserRole(5L, "USER"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("至少保留一个管理员账号");
    }

    @Test
    void updateUserRoleShouldRejectUnsupportedRole() {
        User user = new User();
        user.setId(5L);
        user.setRole("USER");

        when(userMapper.selectById(5L)).thenReturn(user);

        assertThatThrownBy(() -> adminService.updateUserRole(5L, "SUPER_ADMIN"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("不支持的角色");
    }

    @Test
    void deleteUserShouldRejectDeletingCurrentOperator() {
        User admin = new User();
        admin.setId(1L);
        admin.setRole("ADMIN");

        when(userMapper.selectById(1L)).thenReturn(admin);

        assertThatThrownBy(() -> adminService.deleteUser(1L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("不能删除当前登录的管理员账号");
    }

    @Test
    void deleteUserShouldSoftDeleteAccountAfterCleaningFiles() {
        User target = new User();
        target.setId(5L);
        target.setRole("USER");

        FileInfo rootFile = new FileInfo();
        rootFile.setId(8L);
        rootFile.setUserId(5L);
        rootFile.setIsFolder(0);

        when(userMapper.selectById(5L)).thenReturn(target);
        when(fileInfoMapper.selectList(any())).thenReturn(List.of(rootFile));

        adminService.deleteUser(5L, 1L);

        verify(shareLinkMapper).delete(any());
        verify(fileInfoMapper).deleteById(8L);
        verify(userMapper).deleteById(5L);
    }

    @Test
    void deleteFileShouldRemovePhysicalFileAndShares(@TempDir Path tempDir) throws Exception {
        Path filePath = tempDir.resolve("admin-delete.txt");
        Files.writeString(filePath, "cleanup");

        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(8L);
        fileInfo.setIsFolder(0);
        fileInfo.setFilePath(filePath.toString());

        when(fileInfoMapper.selectById(8L)).thenReturn(fileInfo);

        adminService.deleteFile(8L);

        assertThat(filePath).doesNotExist();
        verify(shareLinkMapper).delete(any());
        verify(fileInfoMapper).deleteById(8L);
    }

    @Test
    void disableShareShouldThrowWhenShareMissing() {
        when(shareLinkMapper.selectById(6L)).thenReturn(null);

        assertThatThrownBy(() -> adminService.disableShare(6L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("分享不存在");
    }
}
