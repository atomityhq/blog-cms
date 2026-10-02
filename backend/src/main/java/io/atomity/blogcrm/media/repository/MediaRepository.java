package io.atomity.blogcrm.media.repository;

import io.atomity.blogcrm.media.entity.Media;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface MediaRepository extends JpaRepository<Media, UUID> {

    List<Media> findAllByOrderByCreatedAtDesc();

    /**
     * Where an image is referenced: as a post cover, inside a post body, or as an
     * author avatar. Deleting is refused while this is above zero.
     */
    @Query(value = """
            SELECT (SELECT COUNT(*) FROM posts WHERE cover_image_id = :id)
                 + (SELECT COUNT(*) FROM post_images WHERE media_id = :id)
                 + (SELECT COUNT(*) FROM authors WHERE avatar_id = :id)
            """, nativeQuery = true)
    long countUsages(@Param("id") UUID id);

    /** Usage counts for many images at once, for the library listing. */
    @Query(value = """
            SELECT m.id AS mediaId,
                   (SELECT COUNT(*) FROM posts p WHERE p.cover_image_id = m.id)
                 + (SELECT COUNT(*) FROM post_images pi WHERE pi.media_id = m.id)
                 + (SELECT COUNT(*) FROM authors a WHERE a.avatar_id = m.id) AS usageCount
            FROM media m
            WHERE m.id IN (:ids)
            """, nativeQuery = true)
    List<UsageCount> countUsages(@Param("ids") Collection<UUID> ids);

    interface UsageCount {
        UUID getMediaId();
        Long getUsageCount();
    }
}
