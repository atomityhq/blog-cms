package io.atomity.blogcms.post.service;

import io.atomity.blogcms.post.dto.PublicPostResponse;
import io.atomity.blogcms.post.dto.PublicPostSummary;
import io.atomity.blogcms.post.entity.PostStatus;
import io.atomity.blogcms.post.repository.PostRepository;
import io.atomity.blogcms.post.repository.PostSpecifications;
import io.atomity.blogcms.shared.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Read-only access to published posts for anonymous readers. Drafts and archived posts
 * are never returned, whatever the caller asks for.
 */
@Service
public class PublicPostService {

    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 100;

    private final PostRepository postRepository;

    public PublicPostService(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    /** Published posts, newest first. Out-of-range page and size are clamped, as in the admin list. */
    @Transactional(readOnly = true)
    public Page<PublicPostSummary> list(Integer page, Integer size) {
        return postRepository.findAll(PostSpecifications.hasStatus(PostStatus.PUBLISHED), pageable(page, size))
                .map(PublicPostSummary::of);
    }

    /**
     * One published post. Drafts and archived posts are a 404, not a 403, so readers
     * can't tell an unpublished post from one that doesn't exist.
     */
    @Transactional(readOnly = true)
    public PublicPostResponse get(UUID id) {
        return postRepository.findByIdAndStatus(id, PostStatus.PUBLISHED)
                .map(PublicPostResponse::of)
                .orElseThrow(() -> ApiException.notFound("Post"));
    }

    static Pageable pageable(Integer page, Integer size) {
        int pageNumber = page == null ? 0 : Math.max(0, page);
        int pageSize = size == null ? DEFAULT_SIZE : Math.min(MAX_SIZE, Math.max(1, size));
        // id breaks ties so pages never overlap.
        Sort order = Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.asc("id"));
        return PageRequest.of(pageNumber, pageSize, order);
    }
}
