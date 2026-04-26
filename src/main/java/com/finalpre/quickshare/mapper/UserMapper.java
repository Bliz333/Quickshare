package com.finalpre.quickshare.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.finalpre.quickshare.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    @Update("""
            UPDATE `user`
            SET storage_used = COALESCE(storage_used, 0) + #{fileSizeBytes}
            WHERE id = #{userId}
              AND deleted = 0
              AND (
                    COALESCE(storage_limit, #{defaultLimitBytes}) <= 0
                    OR COALESCE(storage_used, 0) + #{fileSizeBytes} <= COALESCE(storage_limit, #{defaultLimitBytes})
                  )
            """)
    int reserveStorageQuota(@Param("userId") Long userId,
                            @Param("fileSizeBytes") long fileSizeBytes,
                            @Param("defaultLimitBytes") long defaultLimitBytes);
}
