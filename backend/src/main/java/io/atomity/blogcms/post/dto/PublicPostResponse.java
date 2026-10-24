package io.atomity.blogcms.post.dto;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.author.dto.AuthorRef;
import io.atomity.blogcms.media.dto.MediaRef;
import io.atomity.blogcms.post.entity.Post;
import io.atomity.blogcms.tag.dto.TagRef;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A published post as readers see it: the body plus the SEO fields a page needs for its
 * head. Editor-only fields (status, version, focusKeyword, createdAt) are left out.
 */
public record PublicPostResponse(
        UUID id,
        String title,
        String slug,
        String excerpt,
        boolean featured,
        List<AuthorRef> authors,
        List<TagRef> tags,
        MediaRef coverImage,
        String coverImageAlt,
        int wordCount,
        int readingTimeMinutes,
        Instant publishedAt,
        Instant updatedAt,
        JsonNode content,
        String seoTitle,
        String metaDescription,
        String canonicalUrl) {

    public static PublicPostResponse of(Post post) {
        return new PublicPostResponse(post.getId(), post.getTitle(), post.getSlug(), post.getExcerpt(), post.isFeatured(),
                PostSummaryResponse.authorRefs(post), PostSummaryResponse.tagRefs(post), MediaRef.of(post.getCoverImage()),
                post.getCoverImageAlt(), post.getWordCount(), post.getReadingTimeMinutes(), post.getPublishedAt(),
                post.getUpdatedAt(), post.getContent(), post.getSeoTitle(), post.getMetaDescription(),
                post.getCanonicalUrl());
    }
}
