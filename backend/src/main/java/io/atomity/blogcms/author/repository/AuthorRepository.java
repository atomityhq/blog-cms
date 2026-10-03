package io.atomity.blogcms.author.repository;

import io.atomity.blogcms.author.entity.Author;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuthorRepository extends JpaRepository<Author, UUID> {

    @EntityGraph(attributePaths = "avatar")
    List<Author> findAllByOrderByNameAsc();

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    @Query(value = "SELECT author_id AS authorId, COUNT(*) AS postCount FROM post_authors GROUP BY author_id", nativeQuery = true)
    List<PostCount> countPostsPerAuthor();

    @Query(value = "SELECT COUNT(*) FROM post_authors WHERE author_id = :id", nativeQuery = true)
    long countPosts(@Param("id") UUID id);

    @Query(value = "SELECT DISTINCT post_id FROM post_authors WHERE author_id = :id", nativeQuery = true)
    List<UUID> findPostIds(@Param("id") UUID id);

    @Modifying
    @Query(value = "DELETE FROM post_authors WHERE author_id = :id", nativeQuery = true)
    void removeFromAllPosts(@Param("id") UUID id);

    /**
     * Closes the gaps a removal leaves in post_authors.position (an ordered JPA list
     * with gaps loads as nulls). Two passes through negative numbers, so no step ever
     * collides with the (post_id, position) primary key.
     */
    @Modifying
    @Query(value = """
            UPDATE post_authors pa SET position = -r.rn
            FROM (SELECT post_id, position, ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY position) AS rn
                  FROM post_authors WHERE post_id IN (:postIds)) r
            WHERE pa.post_id = r.post_id AND pa.position = r.position
            """, nativeQuery = true)
    void renumberPositionsStepOne(@Param("postIds") Collection<UUID> postIds);

    @Modifying
    @Query(value = "UPDATE post_authors SET position = -position - 1 WHERE post_id IN (:postIds) AND position < 0",
            nativeQuery = true)
    void renumberPositionsStepTwo(@Param("postIds") Collection<UUID> postIds);

    interface PostCount {
        UUID getAuthorId();
        Long getPostCount();
    }
}
