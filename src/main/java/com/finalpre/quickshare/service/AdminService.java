package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.AdminAnnouncementRequest;
import com.finalpre.quickshare.dto.AdminCreateUserRequest;
import com.finalpre.quickshare.vo.AdminAnnouncementResultVO;
import com.finalpre.quickshare.vo.AdminFileVO;
import com.finalpre.quickshare.vo.AdminOverviewVO;
import com.finalpre.quickshare.vo.AdminShareVO;
import com.finalpre.quickshare.vo.UserVO;

import java.util.List;

public interface AdminService {

    AdminOverviewVO getOverview();

    List<UserVO> getUsers();

    List<AdminFileVO> getFiles();

    List<AdminShareVO> getShares();

    UserVO createUser(AdminCreateUserRequest request);

    void updateUserRole(Long userId, String role);

    void deleteUser(Long userId, Long operatorUserId);

    void deleteFile(Long fileId);

    void disableShare(Long shareId);

    AdminAnnouncementResultVO sendAnnouncement(AdminAnnouncementRequest request);
}
