package com.finalpre.quickshare.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class FrontendPageController {

    @GetMapping("/")
    public ResponseEntity<Resource> index() {
        return serve("index.html");
    }

    @GetMapping("/login")
    public ResponseEntity<Resource> login() {
        return serve("login.html");
    }

    @GetMapping("/register")
    public ResponseEntity<Resource> register() {
        return serve("register.html");
    }

    @GetMapping("/share")
    public ResponseEntity<Resource> share() {
        return serve("share.html");
    }

    @GetMapping("/drive")
    public ResponseEntity<Resource> drive() {
        return serve("netdisk.html");
    }

    @GetMapping("/netdisk")
    public ResponseEntity<Void> netdiskAlias(HttpServletRequest request) {
        return redirect("/drive", request);
    }

    @GetMapping("/pricing")
    public ResponseEntity<Resource> pricing() {
        return serve("pricing.html");
    }

    @GetMapping("/payment-result")
    public ResponseEntity<Resource> paymentResult() {
        return serve("payment-result.html");
    }

    @GetMapping("/pdf-viewer")
    public ResponseEntity<Resource> pdfViewer() {
        return serve("pdf-viewer.html");
    }

    @GetMapping("/index.html")
    public ResponseEntity<Void> legacyIndex(HttpServletRequest request) {
        return redirect("/", request);
    }

    @GetMapping("/login.html")
    public ResponseEntity<Void> legacyLogin(HttpServletRequest request) {
        return redirect("/login", request);
    }

    @GetMapping("/register.html")
    public ResponseEntity<Void> legacyRegister(HttpServletRequest request) {
        return redirect("/register", request);
    }

    @GetMapping("/share.html")
    public ResponseEntity<Void> legacyShare(HttpServletRequest request) {
        return redirect("/share", request);
    }

    @GetMapping({"/netdisk.html", "/drive.html"})
    public ResponseEntity<Void> legacyDrive(HttpServletRequest request) {
        return redirect("/drive", request);
    }

    @GetMapping("/pricing.html")
    public ResponseEntity<Void> legacyPricing(HttpServletRequest request) {
        return redirect("/pricing", request);
    }

    @GetMapping("/payment-result.html")
    public ResponseEntity<Void> legacyPaymentResult(HttpServletRequest request) {
        return redirect("/payment-result", request);
    }

    @GetMapping("/pdf-viewer.html")
    public ResponseEntity<Void> legacyPdfViewer(HttpServletRequest request) {
        return redirect("/pdf-viewer", request);
    }

    @GetMapping({"/transfer.html", "/quickdrop.html"})
    public ResponseEntity<Void> legacyQuickDropHome(HttpServletRequest request) {
        return redirect("/", request);
    }

    @GetMapping({"/transfer-share.html", "/quickdrop-share.html"})
    public ResponseEntity<Void> legacyQuickDropShare(HttpServletRequest request) {
        return redirect("/share", request);
    }

    private ResponseEntity<Resource> serve(String fileName) {
        Resource resource = new ClassPathResource("static/" + fileName);
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.TEXT_HTML)
                .body(resource);
    }

    private ResponseEntity<Void> redirect(String location, HttpServletRequest request) {
        String query = request.getQueryString();
        String target = query == null || query.isBlank() ? location : location + "?" + query;
        return ResponseEntity.status(HttpStatus.MOVED_PERMANENTLY).location(java.net.URI.create(target)).build();
    }
}
