package io.atomity.blogcms.post.repository;

import io.atomity.blogcms.post.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PostRepository extends JpaRepository<Post, UUID>, JpaSpecificationExecutor<Post> {

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, UUID id);

    @Query("SELECT p.status AS status, COUNT(p) AS count FROM Post p GROUP BY p.status")
    List<StatusCount> countByStatus();

    interface StatusCount {
        io.atomity.blogcms.post.entity.PostStatus getStatus();
        Long getCount();
    }
}
