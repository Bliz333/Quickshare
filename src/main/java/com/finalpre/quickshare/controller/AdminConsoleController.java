package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.service.AdminConsoleAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class AdminConsoleController {

    @Autowired
    private AdminConsoleAccessService adminConsoleAccessService;

    @GetMapping("/console/{slug}")
    public ResponseEntity<Resource> getConsolePage(@PathVariable String slug) {
        if (!adminConsoleAccessService.matchesSlug(slug)) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = new ClassPathResource("static/admin.html");
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.TEXT_HTML)
                .body(resource);
    }
}
