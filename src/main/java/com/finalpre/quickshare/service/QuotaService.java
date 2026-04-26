package com.finalpre.quickshare.service;

import com.finalpre.quickshare.entity.PaymentOrder;
import com.finalpre.quickshare.entity.User;

public interface QuotaService {

    /** Grant quota to user based on completed payment order. */
    void grantQuota(PaymentOrder order);

    /** Revoke quota previously granted by a completed payment order. */
    void revokeQuota(PaymentOrder order);

    /** Check if user has enough storage for a file of given size. Throws if exceeded. */
    void checkStorageQuota(Long userId, long fileSizeBytes);

    /** Atomically reserve storage for an upload. Returns false for guest/no-user uploads. */
    boolean reserveStorageQuota(Long userId, long fileSizeBytes);

    /** Record storage usage after successful upload. */
    void recordStorageUsed(Long userId, long fileSizeBytes);

    /** Release storage usage after file deletion. */
    void releaseStorage(Long userId, long fileSizeBytes);

    /** Check if user can download. Throws if monthly limit reached. */
    void checkDownloadQuota(Long userId);

    /** Record a download. */
    void recordDownload(Long userId);

    /** Check if user is VIP. */
    boolean isVip(Long userId);

    /** Check if user is still on the default free tier. */
    boolean isDefaultFreeTier(Long userId);
}
