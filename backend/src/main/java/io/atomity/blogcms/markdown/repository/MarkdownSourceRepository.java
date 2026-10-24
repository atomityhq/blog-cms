package io.atomity.blogcms.markdown.repository;

import io.atomity.blogcms.markdown.entity.MarkdownSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.Optional;

@Repository
public interface MarkdownSourceRepository extends JpaRepository<MarkdownSource, UUID> {

    /** Serializes attaching a source to a post against starting its deletion. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM MarkdownSource s WHERE s.id = :id")
    Optional<MarkdownSource> findForUpdate(@Param("id") UUID id);

    /** How many posts still point at the file; a duplicated post shares its source. */
    @Query(value = "SELECT COUNT(*) FROM posts WHERE markdown_source_id = :id", nativeQuery = true)
    long countUsages(@Param("id") UUID id);
}
