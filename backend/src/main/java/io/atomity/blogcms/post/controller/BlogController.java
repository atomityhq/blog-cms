package io.atomity.blogcms.post.controller;

import io.atomity.blogcms.post.dto.PublicPostResponse;
import io.atomity.blogcms.post.dto.PublicPostSummary;
import io.atomity.blogcms.post.service.PublicPostService;
import io.atomity.blogcms.shared.ApiResponse;
import io.atomity.blogcms.shared.PageMeta;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Public, read-only view of published posts. No sign-in needed (see SecurityConfig). */
@RestController
@RequestMapping("/api/v1/blogs")
public class BlogController {

    private final PublicPostService publicPostService;

    public BlogController(PublicPostService publicPostService) {
        this.publicPostService = publicPostService;
    }

    /** GET /api/v1/blogs?page&size — published posts, newest first; pagination in {@code meta}. */
    @GetMapping
    public ApiResponse<List<PublicPostSummary>> list(@RequestParam(required = false) Integer page,
                                                     @RequestParam(required = false) Integer size) {
        Page<PublicPostSummary> result = publicPostService.list(page, size);
        return ApiResponse.ok(result.getContent(), PageMeta.of(result));
    }

    /** A malformed id is a 400 (GlobalExceptionHandler); a draft, archived or unknown post is a 404. */
    @GetMapping("/{id}")
    public ApiResponse<PublicPostResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(publicPostService.get(id));
    }
}
