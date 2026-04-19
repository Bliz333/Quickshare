package com.finalpre.quickshare.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LegacyQuickDropAliasController {

    @GetMapping(value = "/quickdrop.html", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String quickDropPageAlias() {
        return buildRedirectPage("index.html");
    }

    @GetMapping(value = "/quickdrop-share.html", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String quickDropSharePageAlias() {
        return buildPickupRedirectPage();
    }

    private String buildPickupRedirectPage() {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>QuickDrop Redirect</title>
                </head>
                <body>
                <p>QuickDrop pickup moved to <a id="target-link" href="share.html">share.html</a>.</p>
                <script>
                    (function() {
                        var params = new URLSearchParams(window.location.search);
                        var share = params.get('share');
                        var target = 'share.html' + (share ? ('?pickup=' + encodeURIComponent(share)) : '');
                        var link = document.getElementById('target-link');
                        if (link) {
                            link.href = target;
                        }
                        window.location.replace(target + window.location.hash);
                    })();
                </script>
                </body>
                </html>
                """;
    }

    private String buildRedirectPage(String targetPath) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>QuickDrop Redirect</title>
                </head>
                <body>
                <p>QuickDrop moved to <a id="target-link" href="%s">%s</a>.</p>
                <script>
                    (function() {
                        var target = '%s' + window.location.search + window.location.hash;
                        var link = document.getElementById('target-link');
                        if (link) {
                            link.href = target;
                        }
                        window.location.replace(target);
                    })();
                </script>
                </body>
                </html>
                """.formatted(targetPath, targetPath, targetPath);
    }
}
