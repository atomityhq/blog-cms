package io.atomity.blogcms.media.storage;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** {@code blogcms.media.*} — where uploads are written on disk. */
@Validated
@ConfigurationProperties(prefix = "blogcms.media")
public record StorageProperties(@NotBlank String storagePath) {
}
