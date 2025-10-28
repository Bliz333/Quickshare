package com.finalpre.quickshare.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.finalpre.quickshare.entity.FileInfo;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FileInfoMapper extends BaseMapper<FileInfo> {
}