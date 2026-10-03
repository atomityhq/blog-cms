package io.atomity.blogcms.media.dto;

import io.atomity.blogcms.media.entity.Media;

import java.time.Instant;
import java.util.UUID;

public record MediaResponse(
        UUID id,
        String url,
        String originalFilename,
        String contentType,
        long sizeBytes,
        int width,
        int height,
        String altText,
        long usageCount,
        Instant createdAt) {

    public static MediaResponse of(Media media, long usageCount) {
        return new MediaResponse(media.getId(), MediaRef.fileUrl(media.getId()), media.getOriginalFilename(),
                media.getContentType(), media.getSizeBytes(), media.getWidth(), media.getHeight(),
                media.getAltText(), usageCount, media.getCreatedAt());
    }
}
