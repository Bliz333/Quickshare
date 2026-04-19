package com.finalpre.quickshare.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.finalpre.quickshare.common.Result;
import com.finalpre.quickshare.common.UserRole;
import com.finalpre.quickshare.entity.User;
import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.RegistrationSettingsService;
import com.finalpre.quickshare.utils.JwtUtil;
import com.finalpre.quickshare.vo.UserVO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class SocialLoginController {

    private static final Logger log = LoggerFactory.getLogger(SocialLoginController.class);
    private static final String GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token=";
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RegistrationSettingsService registrationSettingsService;

    @PostMapping("/google")
    public Result<UserVO> googleLogin(@RequestBody Map<String, String> body) {
        String googleClientId = registrationSettingsService.getPolicy().googleClientId();
        String idToken = body.get("idToken");
        if (idToken == null || idToken.isBlank()) {
            return Result.error("Missing idToken");
        }

        if (googleClientId == null || googleClientId.isBlank()) {
            return Result.error("Google login is not configured");
        }

        try {
            JsonNode payload = verifyGoogleToken(idToken, googleClientId);
            if (payload == null) {
                return Result.error("Invalid Google token");
            }

            String email = payload.has("email") ? payload.get("email").asText() : null;
            String name = payload.has("name") ? payload.get("name").asText() : null;
            String sub = payload.has("sub") ? payload.get("sub").asText() : null;

            if (email == null || email.isBlank()) {
                return Result.error("Google account has no email");
            }

            User user = findOrCreateUser(email, name, sub);
            String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());

            UserVO vo = new UserVO();
            BeanUtils.copyProperties(user, vo);
            vo.setToken(token);
            vo.setRole(UserRole.normalize(user.getRole()));
            return Result.success(vo);

        } catch (Exception e) {
            log.error("Google login failed", e);
            return Result.error("Google login failed: " + e.getMessage());
        }
    }

    private JsonNode verifyGoogleToken(String idToken, String googleClientId) throws Exception {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GOOGLE_TOKENINFO_URL + idToken))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.warn("Google tokeninfo returned status {}: {}", response.statusCode(), response.body());
            return null;
        }

        JsonNode json = objectMapper.readTree(response.body());

        String aud = json.has("aud") ? json.get("aud").asText() : "";
        if (!googleClientId.equals(aud)) {
            log.warn("Google token aud mismatch: expected={}, got={}", googleClientId, aud);
            return null;
        }

        return json;
    }

    private User findOrCreateUser(String email, String name, String googleSub) {
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.eq("email", email);
        User existing = userMapper.selectOne(wrapper);

        if (existing != null) {
            return existing;
        }

        User user = new User();
        String username = "google_" + googleSub;
        user.setUsername(username);
        user.setPassword("*");
        user.setEmail(email);
        user.setNickname(name != null && !name.isBlank() ? name : email.split("@")[0]);
        user.setRole(UserRole.USER.name());
        userMapper.insert(user);
        return user;
    }
}
