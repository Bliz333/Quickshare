package com.finalpre.quickshare.service;

import com.finalpre.quickshare.dto.LoginDTO;
import com.finalpre.quickshare.dto.RegisterDTO;
import com.finalpre.quickshare.vo.UserVO;

public interface UserService {
    UserVO register(RegisterDTO dto);
    UserVO login(LoginDTO dto);
}