package com.finalpre.quickshare.controller;

import com.finalpre.quickshare.mapper.UserMapper;
import com.finalpre.quickshare.service.LocalStorageRuntimeInfo;
import com.finalpre.quickshare.service.StoragePolicy;
import com.finalpre.quickshare.service.StoragePolicyService;
import com.finalpre.quickshare.service.impl.DelegatingStorageService;
import com.finalpre.quickshare.service.impl.LocalStorageRuntimeInspector;
import com.finalpre.quickshare.utils.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HealthController.class)
@AutoConfigureMockMvc(addFilters = false)
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DataSource dataSource;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @MockBean
    private StoragePolicyService storagePolicyService;

    @MockBean
    private LocalStorageRuntimeInspector localStorageRuntimeInspector;

    @MockBean
    private DelegatingStorageService delegatingStorageService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private UserMapper userMapper;

    @Test
    void shouldExposeLocalStorageMetricsWithoutCreatingMissingUploadDir() throws Exception {
        Connection databaseConnection = mock(Connection.class);
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);
        RedisConnection redisConnection = mock(RedisConnection.class);

        when(dataSource.getConnection()).thenReturn(databaseConnection);
        when(databaseConnection.isValid(3)).thenReturn(true);
        when(redisTemplate.getConnectionFactory()).thenReturn(redisConnectionFactory);
        when(redisConnectionFactory.getConnection()).thenReturn(redisConnection);
        when(redisConnection.ping()).thenReturn("PONG");
        when(storagePolicyService.getPolicy()).thenReturn(new StoragePolicy("local", "", "", "", "", "", false));
        when(localStorageRuntimeInspector.resolve()).thenReturn(new LocalStorageRuntimeInfo(
                "/srv/quickshare/uploads",
                false,
                1_000L,
                860L,
                86.0,
                "healthy"
        ));

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UP"))
                .andExpect(jsonPath("$.data.database").value("UP"))
                .andExpect(jsonPath("$.data.redis").value("UP"))
                .andExpect(jsonPath("$.data.storage").value("local"))
                .andExpect(jsonPath("$.data.storageConnectionStatus").value("local"))
                .andExpect(jsonPath("$.data.storageUploadDir").value("/srv/quickshare/uploads"))
                .andExpect(jsonPath("$.data.storageUploadDirExists").value(false))
                .andExpect(jsonPath("$.data.storageDiskTotalBytes").value(1_000))
                .andExpect(jsonPath("$.data.storageDiskUsableBytes").value(860))
                .andExpect(jsonPath("$.data.storageDiskUsablePercent").value(86.0))
                .andExpect(jsonPath("$.data.storageDiskRiskLevel").value("healthy"));
    }

    @Test
    void shouldKeepHealthResponseCompactForS3Storage() throws Exception {
        Connection databaseConnection = mock(Connection.class);
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);
        RedisConnection redisConnection = mock(RedisConnection.class);

        when(dataSource.getConnection()).thenReturn(databaseConnection);
        when(databaseConnection.isValid(3)).thenReturn(true);
        when(redisTemplate.getConnectionFactory()).thenReturn(redisConnectionFactory);
        when(redisConnectionFactory.getConnection()).thenReturn(redisConnection);
        when(redisConnection.ping()).thenReturn("PONG");
        StoragePolicy policy = new StoragePolicy(
                "s3",
                "https://s3.example.com",
                "access",
                "secret",
                "quickshare",
                "auto",
                true
        );
        when(storagePolicyService.getPolicy()).thenReturn(policy);
        when(delegatingStorageService.testS3Connection(policy)).thenReturn(null);

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UP"))
                .andExpect(jsonPath("$.data.storage").value("s3"))
                .andExpect(jsonPath("$.data.storageConnectionStatus").value("connected"))
                .andExpect(jsonPath("$.data.storageEndpoint").value("https://s3.example.com"))
                .andExpect(jsonPath("$.data.storageBucket").value("quickshare"))
                .andExpect(jsonPath("$.data.storageUploadDir").doesNotExist())
                .andExpect(jsonPath("$.data.storageDiskTotalBytes").doesNotExist())
                .andExpect(jsonPath("$.data.storageDiskUsableBytes").doesNotExist());
    }
}
