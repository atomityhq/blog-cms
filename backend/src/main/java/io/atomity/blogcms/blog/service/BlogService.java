package io.atomity.blogcms.blog.service;

import io.atomity.blogcms.blog.dto.BlogListQuery;
import io.atomity.blogcms.blog.dto.BlogResponse;
import io.atomity.blogcms.blog.dto.BlogSummaryResponse;
import io.atomity.blogcms.post.entity.Post;
import io.atomity.blogcms.post.entity.PostStatus;
import io.atomity.blogcms.post.repository.PostRepository;
import io.atomity.blogcms.post.repository.PostSpecifications;
import io.atomity.blogcms.shared.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Read-only access to published posts for public readers. Drafts and archived posts answer
 * exactly like missing ones (404), so their existence never leaks.
 */
@Service
public class BlogService {

    private final PostRepository postRepository;

    public BlogService(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    @Transactional(readOnly = true)
    public Page<BlogSummaryResponse> list(BlogListQuery query) {
        Page<Post> page = postRepository.findAll(PostSpecifications.hasStatus(PostStatus.PUBLISHED), query.toPageable());

        if (page.hasContent()) {
            postRepository.findWithRelationsByIdIn(page.map(Post::getId).getContent());
        }

        return page.map(BlogSummaryResponse::of);
    }

    @Transactional(readOnly = true)
    public BlogResponse get(UUID id) {
        return postRepository.findByIdAndStatus(id, PostStatus.PUBLISHED)
                .map(BlogResponse::of)
                .orElseThrow(() -> ApiException.notFound("Post"));
    }

    @Transactional(readOnly = true)
    public BlogResponse getBySlug(String slug) {
            return postRepository.findBySlugAndStatus(slug, PostStatus.PUBLISHED)
                .map(BlogResponse::of)
                .orElseThrow(() -> ApiException.notFound("Post"));
    }
}
