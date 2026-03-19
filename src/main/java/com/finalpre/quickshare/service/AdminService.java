package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.AdminAnnouncementRequest;
import com.finalpre.quickshare.dto.AdminCreateUserRequest;
import com.finalpre.quickshare.dto.AdminPaymentProviderRequest;
import com.finalpre.quickshare.dto.AdminPlanRequest;
import com.finalpre.quickshare.entity.Plan;
import com.finalpre.quickshare.vo.AdminPaymentProviderVO;
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

    List<Plan> getPlans();

    Plan createPlan(AdminPlanRequest request);

    Plan updatePlan(Long planId, AdminPlanRequest request);

    void deletePlan(Long planId);

    List<AdminPaymentProviderVO> getPaymentProviders();

    AdminPaymentProviderVO createPaymentProvider(AdminPaymentProviderRequest request);

    AdminPaymentProviderVO updatePaymentProvider(Long providerId, AdminPaymentProviderRequest request);

    void deletePaymentProvider(Long providerId);
}
