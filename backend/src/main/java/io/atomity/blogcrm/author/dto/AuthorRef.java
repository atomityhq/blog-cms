package io.atomity.blogcrm.author.dto;

import io.atomity.blogcrm.author.entity.Author;
import io.atomity.blogcrm.media.dto.MediaRef;

import java.util.UUID;

/** An author as embedded in a post response. */
public record AuthorRef(UUID id, String name, MediaRef avatar) {

    public static AuthorRef of(Author author) {
        return new AuthorRef(author.getId(), author.getName(), MediaRef.of(author.getAvatar()));
    }
}
