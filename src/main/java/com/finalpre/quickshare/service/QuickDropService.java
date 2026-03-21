package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.QuickDropCreateTransferRequest;
import com.finalpre.quickshare.dto.QuickDropDirectAttemptSyncRequest;
import com.finalpre.quickshare.dto.QuickDropPublicShareCreateRequest;
import com.finalpre.quickshare.dto.QuickDropSyncRequest;
import com.finalpre.quickshare.entity.QuickDropTransfer;
import com.finalpre.quickshare.entity.QuickDropPublicShare;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.QuickDropPublicShareVO;
import com.finalpre.quickshare.vo.QuickDropSyncVO;
import com.finalpre.quickshare.vo.QuickDropTaskVO;
import com.finalpre.quickshare.vo.QuickDropTransferVO;

public interface QuickDropService {

    QuickDropSyncVO syncDevice(Long userId, QuickDropSyncRequest request);

    QuickDropTransferVO createTransfer(Long userId, QuickDropCreateTransferRequest request);

    QuickDropTransferVO getTransfer(Long userId, Long transferId, String deviceId);

    QuickDropTransferVO uploadChunk(Long userId, Long transferId, String deviceId, Integer chunkIndex, byte[] body);

    QuickDropTaskVO syncDirectAttempt(Long userId, QuickDropDirectAttemptSyncRequest request);

    QuickDropTransfer openDownload(Long userId, Long transferId, String deviceId);

    FileInfoVO saveTransferToNetdisk(Long userId, Long transferId, String deviceId, Long folderId);

    void deleteTask(Long userId, Long taskId, String deviceId);

    void deleteDirectAttempt(Long userId, Long taskId, String deviceId, String clientTransferId);

    void deleteTransfer(Long userId, Long transferId, String deviceId);

    QuickDropPublicShareVO createPublicShare(Long uploaderUserId, QuickDropPublicShareCreateRequest request);

    QuickDropPublicShareVO getPublicShare(String shareToken);

    QuickDropPublicShareVO uploadPublicShareChunk(String shareToken, Integer chunkIndex, byte[] body);

    QuickDropPublicShare openPublicShareDownload(String shareToken);

    FileInfoVO savePublicShareToNetdisk(Long userId, String shareToken, Long folderId);

    int cleanupExpiredTransfers();
}
