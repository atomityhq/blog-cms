package io.atomity.blogcms.author.dto;

import io.atomity.blogcms.author.entity.Author;
import io.atomity.blogcms.media.dto.MediaRef;

import java.util.UUID;

/** An author as embedded in a post response. */
public record AuthorRef(UUID id, String name, MediaRef avatar) {

    public static AuthorRef of(Author author) {
        return new AuthorRef(author.getId(), author.getName(), MediaRef.of(author.getAvatar()));
    }
}
