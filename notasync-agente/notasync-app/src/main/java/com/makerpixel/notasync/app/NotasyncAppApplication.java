package com.makerpixel.notasync.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NotasyncAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotasyncAppApplication.class, args);
    }
}
