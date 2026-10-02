package io.atomity.blogcrm.post.entity;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcrm.author.entity.Author;
import io.atomity.blogcrm.media.entity.Media;
import io.atomity.blogcrm.tag.entity.Tag;

import java.util.Collection;
import java.util.List;

/**
 * Everything an edit sets on a post, already validated and resolved (relations as
 * entities, content metrics derived) by PostService.
 */
public record PostEdit(
        String title,
        String slug,
        String excerpt,
        JsonNode content,
        String contentText,
        int wordCount,
        int readingTimeMinutes,
        Media coverImage,
        String coverImageAlt,
        String seoTitle,
        String metaDescription,
        String focusKeyword,
        String canonicalUrl,
        boolean featured,
        List<Author> authors,
        Collection<Tag> tags,
        Collection<Media> inlineImages) {
}
