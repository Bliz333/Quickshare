package com.finalpre.quickshare.service;

import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public interface TransferSignalingService {

    /**
     * Register a session and automatically join the IP-based room for LAN discovery.
     * Broadcasts a room-update to all other room members.
     */
    void registerSession(String channelId, String label, String clientIp, WebSocketSession session) throws IOException;

    /**
     * Unregister a session and remove it from its room. Broadcasts room-update to remaining members.
     */
    void unregisterSession(String channelId);

    void bindPairSession(String pairSessionId, String leftChannelId, String rightChannelId) throws IOException;

    void forwardSignal(String pairSessionId, String fromChannelId, String signalType, Object payload) throws IOException;

    boolean isConnected(String channelId);

    String resolvePeerChannel(String pairSessionId, String channelId);

    Map<String, Object> buildWelcomeMessage(String channelId, String label);

    /**
     * Compute a room ID from a client IP. Uses /24 subnet for IPv4 so all devices on
     * the same LAN segment share a room (same Snapdrop grouping logic).
     */
    String getRoomId(String clientIp);

    /**
     * Returns all device descriptors currently in the given room.
     */
    List<Map<String, Object>> getRoomDevices(String roomId);

    /**
     * Returns the current discovery room for the given channel.
     */
    String getChannelRoomId(String channelId);

    /**
     * Auto-pair two room members without a manually exchanged pair code.
     * Generates a pairSessionId and calls bindPairSession internally.
     */
    String requestRoomTransfer(String initiatorChannelId, String targetChannelId) throws IOException;

    /**
     * Create a temporary public room, switch the channel into it, and return the public room code.
     */
    String createPublicRoom(String channelId) throws IOException;

    /**
     * Join an existing temporary public room and return the normalized room code.
     */
    String joinPublicRoom(String channelId, String roomCode) throws IOException;

    /**
     * Leave the current temporary public room and switch the channel back to its default LAN room.
     */
    void leavePublicRoom(String channelId) throws IOException;
}
