package io.atomity.blogcms.author.dto;

import io.atomity.blogcms.author.entity.Author;
import io.atomity.blogcms.media.dto.MediaRef;

import java.time.Instant;
import java.util.UUID;

public record AuthorResponse(UUID id, String name, String slug, String bio, MediaRef avatar, long postCount, Instant createdAt) {

    public static AuthorResponse of(Author author, long postCount) {
        return new AuthorResponse(author.getId(), author.getName(), author.getSlug(), author.getBio(),
                MediaRef.of(author.getAvatar()), postCount, author.getCreatedAt());
    }
}
