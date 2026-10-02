package io.atomity.blogcrm.post.dto;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcrm.author.dto.AuthorRef;
import io.atomity.blogcrm.media.dto.MediaRef;
import io.atomity.blogcrm.post.entity.Post;
import io.atomity.blogcrm.post.entity.PostStatus;
import io.atomity.blogcrm.tag.dto.TagRef;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A full post, as the editor loads it. */
public record PostResponse(
        UUID id,
        String title,
        String slug,
        String excerpt,
        PostStatus status,
        boolean featured,
        List<AuthorRef> authors,
        List<TagRef> tags,
        MediaRef coverImage,
        int wordCount,
        int readingTimeMinutes,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        JsonNode content,
        String coverImageAlt,
        String seoTitle,
        String metaDescription,
        String focusKeyword,
        String canonicalUrl,
        long version) {

    public static PostResponse of(Post post) {
        return new PostResponse(post.getId(), post.getTitle(), post.getSlug(), post.getExcerpt(), post.getStatus(),
                post.isFeatured(), PostSummaryResponse.authorRefs(post), PostSummaryResponse.tagRefs(post),
                MediaRef.of(post.getCoverImage()), post.getWordCount(), post.getReadingTimeMinutes(), post.getPublishedAt(),
                post.getCreatedAt(), post.getUpdatedAt(), post.getContent(), post.getCoverImageAlt(), post.getSeoTitle(),
                post.getMetaDescription(), post.getFocusKeyword(), post.getCanonicalUrl(), post.getVersion());
    }
}
