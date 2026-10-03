package io.atomity.blogcms.media.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateMediaRequest(
        @NotNull(message = "is required")
        @Size(max = 300, message = "must be at most 300 characters")
        String altText) {
}
