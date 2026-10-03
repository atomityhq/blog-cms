package io.atomity.blogcms.author.controller;

import io.atomity.blogcms.author.dto.AuthorRequest;
import io.atomity.blogcms.author.dto.AuthorResponse;
import io.atomity.blogcms.author.service.AuthorService;
import io.atomity.blogcms.shared.ApiResponse;
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
@RequestMapping("/api/v1/authors")
public class AuthorController {

    private final AuthorService authorService;

    public AuthorController(AuthorService authorService) {
        this.authorService = authorService;
    }

    @GetMapping
    public ApiResponse<List<AuthorResponse>> list() {
        return ApiResponse.ok(authorService.list());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AuthorResponse>> create(@Valid @RequestBody AuthorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(authorService.create(request)));
    }

    @PutMapping("/{id}")
    public ApiResponse<AuthorResponse> update(@PathVariable UUID id, @Valid @RequestBody AuthorRequest request) {
        return ApiResponse.ok(authorService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        authorService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
