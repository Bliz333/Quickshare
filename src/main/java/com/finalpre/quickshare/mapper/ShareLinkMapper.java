package com.finalpre.quickshare.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.finalpre.quickshare.entity.ShareLink;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ShareLinkMapper extends BaseMapper<ShareLink> {

    /**
     * Atomically increment download_count if within the allowed limit.
     * Returns 1 if updated (download allowed), 0 if limit reached.
     */
    @Update("UPDATE share_link SET download_count = download_count + 1 " +
            "WHERE id = #{id} AND status = 1 " +
            "AND (max_download = -1 OR download_count < max_download)")
    int incrementDownloadCount(@Param("id") Long id);
}