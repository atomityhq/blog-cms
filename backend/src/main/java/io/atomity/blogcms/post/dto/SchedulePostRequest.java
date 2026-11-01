package io.atomity.blogcms.post.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record SchedulePostRequest(
        @NotNull Instant scheduledAt
) {
}