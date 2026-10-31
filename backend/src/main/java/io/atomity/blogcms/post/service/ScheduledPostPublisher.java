package io.atomity.blogcms.post.service;

import io.atomity.blogcms.post.entity.Post;
import io.atomity.blogcms.post.entity.PostStatus;
import io.atomity.blogcms.post.repository.PostRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
public class ScheduledPostPublisher {

    private static final Logger log =
            LoggerFactory.getLogger(ScheduledPostPublisher.class);

    private final PostRepository postRepository;

    public ScheduledPostPublisher(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    @Scheduled(fixedDelayString = "${blog.scheduling.fixed-delay-ms:15000}")
    @Transactional
    public void publishDuePosts() {
        Instant now = Instant.now();

        List<Post> duePosts =
                postRepository.findAllByStatusAndScheduledAtLessThanEqual(
                        PostStatus.SCHEDULED, now);

        for (Post post : duePosts) {
            if (post.getTitle().isBlank() || post.hasNoContent()) {
                log.warn("Skipping scheduled post {} because it has no title or content",
                        post.getId());
                continue;
            }

            post.publish();
            postRepository.save(post);

            log.info("Published scheduled post {}", post.getId());
        }
    }
}
