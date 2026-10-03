package io.atomity.blogcms.tag.repository;

import io.atomity.blogcms.tag.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TagRepository extends JpaRepository<Tag, UUID> {

    List<Tag> findAllByOrderByNameAsc();

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    @Query(value = "SELECT tag_id AS tagId, COUNT(*) AS postCount FROM post_tags GROUP BY tag_id", nativeQuery = true)
    List<PostCount> countPostsPerTag();

    @Query(value = "SELECT COUNT(*) FROM post_tags WHERE tag_id = :id", nativeQuery = true)
    long countPosts(@Param("id") UUID id);

    interface PostCount {
        UUID getTagId();
        Long getPostCount();
    }
}
