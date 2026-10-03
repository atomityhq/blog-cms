package io.atomity.blogcms.tag.controller;

import io.atomity.blogcms.shared.ApiResponse;
import io.atomity.blogcms.tag.dto.TagRequest;
import io.atomity.blogcms.tag.dto.TagResponse;
import io.atomity.blogcms.tag.service.TagService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public ApiResponse<List<TagResponse>> list() {
        return ApiResponse.ok(tagService.list());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TagResponse>> create(@Valid @RequestBody TagRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(tagService.create(request)));
    }

    @PutMapping("/{id}")
    public ApiResponse<TagResponse> update(@PathVariable UUID id, @Valid @RequestBody TagRequest request) {
        return ApiResponse.ok(tagService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        tagService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
