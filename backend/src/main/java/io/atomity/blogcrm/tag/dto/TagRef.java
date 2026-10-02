package io.atomity.blogcrm.tag.dto;

import io.atomity.blogcrm.tag.entity.Tag;

import java.util.UUID;

/** A tag as embedded in a post response. */
public record TagRef(UUID id, String name, String slug) {

    public static TagRef of(Tag tag) {
        return new TagRef(tag.getId(), tag.getName(), tag.getSlug());
    }
}
