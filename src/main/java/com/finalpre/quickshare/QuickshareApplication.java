package com.finalpre.quickshare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class QuickshareApplication {

    public static void main(String[] args) {
        SpringApplication.run(QuickshareApplication.class, args);
    }

}