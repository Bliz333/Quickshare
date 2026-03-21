package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.QuickDropDirectSessionCreateRequest;
import com.finalpre.quickshare.dto.QuickDropPairCodeClaimRequest;
import com.finalpre.quickshare.dto.QuickDropPairCodeCreateRequest;
import com.finalpre.quickshare.dto.QuickDropPairTaskSyncRequest;
import com.finalpre.quickshare.vo.QuickDropDirectSessionVO;
import com.finalpre.quickshare.vo.QuickDropPairClaimVO;
import com.finalpre.quickshare.vo.QuickDropPairCodeVO;
import com.finalpre.quickshare.vo.QuickDropPairTaskVO;

public interface QuickDropPairingService {

    QuickDropPairCodeVO createPairCode(Long userId, QuickDropPairCodeCreateRequest request);

    QuickDropPairClaimVO claimPairCode(Long userId, String code, QuickDropPairCodeClaimRequest request);

    QuickDropDirectSessionVO createDirectSession(Long userId, QuickDropDirectSessionCreateRequest request);

    QuickDropPairTaskVO syncPairTask(QuickDropPairTaskSyncRequest request);

    java.util.List<QuickDropPairTaskVO> listPairTasks(String pairSessionId, String selfChannelId);

    void deletePairTaskAttempt(Long taskId, String pairSessionId, String selfChannelId, String clientTransferId);
}
