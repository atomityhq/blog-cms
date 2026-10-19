package io.atomity.blogcms.blog.dto;

import io.atomity.blogcms.author.dto.AuthorRef;
import io.atomity.blogcms.media.dto.MediaRef;
import io.atomity.blogcms.post.entity.Post;
import io.atomity.blogcms.tag.dto.TagRef;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** One published post in the public list — everything except the body and editor-only fields. */
public record BlogSummaryResponse(
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
        Instant publishedAt) {

    public static BlogSummaryResponse of(Post post) {
        return new BlogSummaryResponse(post.getId(), post.getTitle(), post.getSlug(), post.getExcerpt(),
                post.isFeatured(), authorRefs(post), tagRefs(post), MediaRef.of(post.getCoverImage()),
                post.getWordCount(), post.getReadingTimeMinutes(), post.getPublishedAt());
    }

    static List<AuthorRef> authorRefs(Post post) {
        return post.getAuthors().stream().map(AuthorRef::of).toList();
    }

    /** Tags are a set; sort by name so responses are stable. */
    static List<TagRef> tagRefs(Post post) {
        return post.getTags().stream().map(TagRef::of).sorted(Comparator.comparing(TagRef::name)).toList();
    }
}
