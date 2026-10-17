package io.atomity.blogcms.post.controller;

import io.atomity.blogcms.post.dto.PostListQuery;
import io.atomity.blogcms.post.dto.PostResponse;
import io.atomity.blogcms.post.dto.PostSummaryResponse;
import io.atomity.blogcms.post.dto.PublicBlogResponse;
import io.atomity.blogcms.post.dto.PublicBlogSummaryResponse;
import io.atomity.blogcms.post.entity.PostStatus;
import io.atomity.blogcms.post.service.PostService;
import io.atomity.blogcms.shared.ApiException;
import io.atomity.blogcms.shared.ApiResponse;
import io.atomity.blogcms.shared.PageMeta;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/blogs")
public class PublicBlogController {

    private final PostService postService;

    public PublicBlogController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public ApiResponse<List<PublicBlogSummaryResponse>> listPublished(
            @PageableDefault(size = 10, sort = "publishedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        String sortField = pageable.getSort().isSorted()
                ? pageable.getSort().iterator().next().getProperty()
                : "publishedAt";
        String sortDir = pageable.getSort().isSorted()
                ? pageable.getSort().iterator().next().getDirection().name().toLowerCase()
                : "desc";
        PostListQuery query = new PostListQuery(PostStatus.PUBLISHED, null, null, null,
                sortField, sortDir, pageable.getPageNumber(), pageable.getPageSize());
        Page<PostSummaryResponse> page = postService.list(query);
        List<PublicBlogSummaryResponse> blogs = page.getContent().stream()
                .map(PublicBlogSummaryResponse::of)
                .toList();
        return ApiResponse.ok(blogs, PageMeta.of(page));
    }

    @GetMapping("/{id}")
    public ApiResponse<PublicBlogResponse> getPublished(@PathVariable UUID id) {
        PostResponse post = postService.get(id);
        if (post.status() != PostStatus.PUBLISHED) {
            throw ApiException.notFound("Post");
        }
        return ApiResponse.ok(PublicBlogResponse.of(post));
    }
}
