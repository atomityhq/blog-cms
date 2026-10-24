package io.atomity.blogcms.post.dto;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.author.dto.AuthorRef;
import io.atomity.blogcms.media.dto.MediaRef;
import io.atomity.blogcms.tag.dto.TagRef;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Reader-facing fields for a published blog and its content. */
public record PublicBlogResponse(
        UUID id,
        String title,
        String slug,
        String excerpt,
        boolean featured,
        List<AuthorRef> authors,
        List<TagRef> tags,
        MediaRef coverImage,
        int wordCount,
        int readingTimeMinutes,
        Instant publishedAt,
        JsonNode content,
        String coverImageAlt) {

    public static PublicBlogResponse of(PostResponse post) {
        return new PublicBlogResponse(post.id(), post.title(), post.slug(), post.excerpt(),
                post.featured(), post.authors(), post.tags(), post.coverImage(), post.wordCount(),
                post.readingTimeMinutes(), post.publishedAt(), post.content(), post.coverImageAlt());
    }
}
