package com.finalpre.quickshare.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.finalpre.quickshare.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}