package io.atomity.blogcrm.media.storage;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** {@code blogcrm.media.*} — where uploads are written on disk. */
@Validated
@ConfigurationProperties(prefix = "blogcrm.media")
public record StorageProperties(@NotBlank String storagePath) {
}
