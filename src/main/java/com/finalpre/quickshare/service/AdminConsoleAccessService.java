package com.finalpre.quickshare.service;

public interface AdminConsoleAccessService {

    AdminConsoleAccessPolicy getPolicy();

    String getEntryPath();

    boolean matchesSlug(String slug);
}
