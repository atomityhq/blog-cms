package io.atomity.blogcms.blog.dto;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.author.dto.AuthorRef;
import io.atomity.blogcms.media.dto.MediaRef;
import io.atomity.blogcms.post.entity.Post;
import io.atomity.blogcms.tag.dto.TagRef;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A full published post, as a public reader sees it — no status, version or editor-only SEO fields. */
public record BlogResponse(
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
        JsonNode content,
        String seoTitle,
        String metaDescription,
        String canonicalUrl) {

    public static BlogResponse of(Post post) {
        return new BlogResponse(post.getId(), post.getTitle(), post.getSlug(), post.getExcerpt(), post.isFeatured(),
                BlogSummaryResponse.authorRefs(post), BlogSummaryResponse.tagRefs(post),
                MediaRef.of(post.getCoverImage()), post.getCoverImageAlt(), post.getWordCount(),
                post.getReadingTimeMinutes(), post.getPublishedAt(), post.getContent(), post.getSeoTitle(),
                post.getMetaDescription(), post.getCanonicalUrl());
    }
}
