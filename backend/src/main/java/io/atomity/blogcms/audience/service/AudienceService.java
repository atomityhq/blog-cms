package io.atomity.blogcms.audience.service;

import io.atomity.blogcms.audience.dto.AudienceRequest;
import io.atomity.blogcms.audience.dto.AudienceResponse;
import io.atomity.blogcms.audience.entity.Audience;
import io.atomity.blogcms.audience.repository.AudienceRepository;
import io.atomity.blogcms.shared.ApiException;
import io.atomity.blogcms.shared.Slugs;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AudienceService {
    private final AudienceRepository audienceRepository;

    public AudienceService(AudienceRepository audienceRepository) {
        this.audienceRepository = audienceRepository;
    }

    @Transactional
    public AudienceResponse create(AudienceRequest request) {
        Audience audience = audienceRepository.save(Audience.create(request.name(), resolveSlug(request, null)));
        return AudienceResponse.of(audience, 0);
    }

    private String resolveSlug(AudienceRequest request, UUID selfId) {
        String slug = request.slug() == null || request.slug().isBlank() ? Slugs.slugify(request.name()) : request.slug();
        if (slug.isEmpty()) {
            throw ApiException.badRequest("VALIDATION_ERROR", "slug could not be derived from the name; enter one");
        }
        boolean taken = selfId == null ? audienceRepository.existsBySlug(slug) : audienceRepository.existsBySlugAndIdNot(slug, selfId);
        if (taken) {
            throw ApiException.conflict("SLUG_TAKEN", "An audience with the slug \"" + slug + "\" already exists");
        }
        return slug;
    }
}
