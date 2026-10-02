package io.atomity.blogcrm.tag.dto;

import io.atomity.blogcrm.tag.entity.Tag;

import java.time.Instant;
import java.util.UUID;

public record TagResponse(UUID id, String name, String slug, long postCount, Instant createdAt) {

    public static TagResponse of(Tag tag, long postCount) {
        return new TagResponse(tag.getId(), tag.getName(), tag.getSlug(), postCount, tag.getCreatedAt());
    }
}
