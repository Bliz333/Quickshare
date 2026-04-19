package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.TransferDirectSessionCreateRequest;
import com.finalpre.quickshare.dto.TransferPairCodeClaimRequest;
import com.finalpre.quickshare.dto.TransferPairCodeCreateRequest;
import com.finalpre.quickshare.dto.TransferPairTaskSyncRequest;
import com.finalpre.quickshare.vo.TransferDirectSessionVO;
import com.finalpre.quickshare.vo.TransferPairClaimVO;
import com.finalpre.quickshare.vo.TransferPairCodeVO;
import com.finalpre.quickshare.vo.TransferPairTaskVO;

public interface TransferPairingService {

    TransferPairCodeVO createPairCode(Long userId, TransferPairCodeCreateRequest request);

    TransferPairClaimVO claimPairCode(Long userId, String code, TransferPairCodeClaimRequest request);

    TransferDirectSessionVO createDirectSession(Long userId, TransferDirectSessionCreateRequest request);

    TransferPairTaskVO syncPairTask(TransferPairTaskSyncRequest request);

    java.util.List<TransferPairTaskVO> listPairTasks(String pairSessionId, String selfChannelId);

    void deletePairTaskAttempt(Long taskId, String pairSessionId, String selfChannelId, String clientTransferId);
}
