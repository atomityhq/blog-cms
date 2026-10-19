package io.atomity.blogcms.blog.dto;

import io.atomity.blogcms.post.dto.PostListQuery;
import org.springframework.data.domain.Pageable;

/**
 * Query parameters of GET /api/v1/blogs. Same sort, direction and paging rules as the admin
 * posts list, but newest published first by default.
 */
public record BlogListQuery(String sort, String direction, Integer page, Integer size) {

    public Pageable toPageable() {
        return new PostListQuery(null, null, null, null,
                sort == null ? "publishedAt" : sort, direction, page, size).toPageable();
    }
}
