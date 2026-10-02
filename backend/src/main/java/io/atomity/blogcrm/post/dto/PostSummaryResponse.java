package io.atomity.blogcrm.post.dto;

import io.atomity.blogcrm.author.dto.AuthorRef;
import io.atomity.blogcrm.media.dto.MediaRef;
import io.atomity.blogcrm.post.entity.Post;
import io.atomity.blogcrm.post.entity.PostStatus;
import io.atomity.blogcrm.tag.dto.TagRef;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** One row in the posts list — everything except the body. */
public record PostSummaryResponse(
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
        Instant updatedAt) {

    public static PostSummaryResponse of(Post post) {
        return new PostSummaryResponse(post.getId(), post.getTitle(), post.getSlug(), post.getExcerpt(), post.getStatus(),
                post.isFeatured(), authorRefs(post), tagRefs(post), MediaRef.of(post.getCoverImage()), post.getWordCount(),
                post.getReadingTimeMinutes(), post.getPublishedAt(), post.getCreatedAt(), post.getUpdatedAt());
    }

    static List<AuthorRef> authorRefs(Post post) {
        return post.getAuthors().stream().map(AuthorRef::of).toList();
    }

    /** Tags are a set; sort by name so responses are stable. */
    static List<TagRef> tagRefs(Post post) {
        return post.getTags().stream().map(TagRef::of).sorted(Comparator.comparing(TagRef::name)).toList();
    }
}
