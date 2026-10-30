package io.atomity.blogcms.audience.repository;

import io.atomity.blogcms.audience.entity.Audience;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface AudienceRepository extends JpaRepository<Audience, UUID> {
    boolean existsBySlug(String slug);
    boolean existsBySlugAndIdNot(String slug, UUID id);
}
