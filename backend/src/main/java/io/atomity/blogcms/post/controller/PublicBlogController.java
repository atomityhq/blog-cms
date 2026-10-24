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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
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
            @RequestParam(required = false) List<String> sort,
            @RequestParam(required = false) String direction,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        List<String> sortFields = sort == null || sort.isEmpty() ? List.of("publishedAt") : sort;
        PostListQuery query = new PostListQuery(PostStatus.PUBLISHED, null, null, null, sortFields,
                direction == null ? "desc" : direction, page, size);
        Page<PostSummaryResponse> resultPage = postService.list(query);
        List<PublicBlogSummaryResponse> blogs = resultPage.getContent().stream()
                .map(PublicBlogSummaryResponse::of)
                .toList();
        return ApiResponse.ok(blogs, PageMeta.of(resultPage));
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
