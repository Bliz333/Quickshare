package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.TransferCreateRequest;
import com.finalpre.quickshare.dto.TransferDirectAttemptSyncRequest;
import com.finalpre.quickshare.dto.TransferPublicShareCreateRequest;
import com.finalpre.quickshare.dto.TransferSyncRequest;
import com.finalpre.quickshare.entity.TransferRelay;
import com.finalpre.quickshare.entity.TransferPublicShare;
import com.finalpre.quickshare.vo.FileInfoVO;
import com.finalpre.quickshare.vo.TransferPublicShareVO;
import com.finalpre.quickshare.vo.TransferSyncVO;
import com.finalpre.quickshare.vo.TransferTaskVO;
import com.finalpre.quickshare.vo.TransferRelayVO;

public interface TransferService {

    TransferSyncVO syncDevice(Long userId, TransferSyncRequest request);

    TransferRelayVO createTransfer(Long userId, TransferCreateRequest request);

    TransferRelayVO getTransfer(Long userId, Long transferId, String deviceId);

    TransferRelayVO uploadChunk(Long userId, Long transferId, String deviceId, Integer chunkIndex, byte[] body);

    TransferTaskVO syncDirectAttempt(Long userId, TransferDirectAttemptSyncRequest request);

    TransferRelay openDownload(Long userId, Long transferId, String deviceId);

    FileInfoVO saveTransferToNetdisk(Long userId, Long transferId, String deviceId, Long folderId);

    void deleteTask(Long userId, Long taskId, String deviceId);

    void deleteDirectAttempt(Long userId, Long taskId, String deviceId, String clientTransferId);

    void deleteTransfer(Long userId, Long transferId, String deviceId);

    TransferPublicShareVO createPublicShare(Long uploaderUserId, TransferPublicShareCreateRequest request);

    TransferPublicShareVO getPublicShare(String shareToken);

    TransferPublicShareVO uploadPublicShareChunk(String shareToken, Integer chunkIndex, byte[] body);

    TransferPublicShare openPublicShareDownload(String shareToken);

    FileInfoVO savePublicShareToNetdisk(Long userId, String shareToken, Long folderId);

    int cleanupExpiredTransfers();
}
