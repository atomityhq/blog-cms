package io.atomity.blogcms.audience.controller;

import io.atomity.blogcms.audience.dto.AudienceRequest;
import io.atomity.blogcms.audience.dto.AudienceResponse;
import io.atomity.blogcms.audience.service.AudienceService;
import io.atomity.blogcms.shared.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audiences")
public class AudienceController {
    private final AudienceService audienceService;

    public AudienceController(AudienceService audienceService) {
        this.audienceService = audienceService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AudienceResponse>> create(@Valid @RequestBody AudienceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(audienceService.create(request)));
    }

}
