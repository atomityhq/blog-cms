package io.atomity.blogcms.post.dto;

import io.atomity.blogcms.author.dto.AuthorRef;
import io.atomity.blogcms.media.dto.MediaRef;
import io.atomity.blogcms.post.entity.Post;
import io.atomity.blogcms.tag.dto.TagRef;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** One published post in the public blog list — no body, no editorial fields. */
public record PublicPostSummary(
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
        Instant updatedAt) {

    public static PublicPostSummary of(Post post) {
        return new PublicPostSummary(post.getId(), post.getTitle(), post.getSlug(), post.getExcerpt(), post.isFeatured(),
                PostSummaryResponse.authorRefs(post), PostSummaryResponse.tagRefs(post), MediaRef.of(post.getCoverImage()),
                post.getCoverImageAlt(), post.getWordCount(), post.getReadingTimeMinutes(), post.getPublishedAt(),
                post.getUpdatedAt());
    }
}
