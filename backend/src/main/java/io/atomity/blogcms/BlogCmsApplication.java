package io.atomity.blogcms;

import io.atomity.blogcms.auth.config.AuthProperties;
import io.atomity.blogcms.media.storage.StorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({AuthProperties.class,StorageProperties.class})
public class BlogCmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(BlogCmsApplication.class, args);
    }
}