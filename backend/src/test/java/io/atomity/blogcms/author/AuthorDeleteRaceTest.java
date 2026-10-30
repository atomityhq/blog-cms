package io.atomity.blogcms.author;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.IntegrationTest;
import io.atomity.blogcms.author.repository.AuthorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthorDeleteRaceTest extends IntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RaceContext raceContext;

    @BeforeEach
    void resetLatches() {
        raceContext.reset();
    }

    @TestConfiguration
    public static class RaceConfig {
        @Bean
        @Primary
        public AuthorRepository raceAuthorRepository(AuthorRepository real, RaceContext context) {
            return (AuthorRepository) Proxy.newProxyInstance(
                    AuthorRepository.class.getClassLoader(),
                    new Class<?>[]{AuthorRepository.class},
                    (proxy, method, args) -> {
                        if (method.getName().equals("removeFromAllPosts")) {
                            Object result = method.invoke(real, args);
                            context.pause.countDown();
                            try {
                                context.resume.await(10, TimeUnit.SECONDS);
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                            }
                            return result;
                        }
                        return method.invoke(real, args);
                    }
            );
        }

        @Bean
        public RaceContext raceContext() {
            return new RaceContext();
        }
    }

    public static class RaceContext {
        public CountDownLatch pause;
        public CountDownLatch resume;

        public RaceContext() {
            reset();
        }

        public void reset() {
            pause = new CountDownLatch(1);
            resume = new CountDownLatch(1);
        }
    }

    private static Map<String, Object> doc(String... paragraphs) {
        List<Map<String, Object>> content = new ArrayList<>();
        for (String text : paragraphs) {
            content.add(Map.of("type", "paragraph", "content", List.of(Map.of("type", "text", "text", text))));
        }
        return Map.of("type", "doc", "content", content);
    }

    private String createAuthor(String name) throws Exception {
        return data(call(post("/api/v1/authors"), Map.of("name", name)).andExpect(status().isCreated()))
                .path("id").asText();
    }

    private String executeRace() throws Exception {
        String xId = createAuthor("X");
        String aliceId = createAuthor("Alice");
        String bobId = createAuthor("Bob");

        Map<String, Object> p1 = new HashMap<>();
        p1.put("title", "P1");
        p1.put("content", doc("text"));
        p1.put("authorIds", List.of(xId));
        call(post("/api/v1/posts"), p1).andExpect(status().isCreated());

        Map<String, Object> p2Body = new HashMap<>();
        p2Body.put("title", "P2");
        p2Body.put("content", doc("text"));
        p2Body.put("authorIds", List.of(aliceId, bobId));
        JsonNode p2 = data(call(post("/api/v1/posts"), p2Body).andExpect(status().isCreated()));
        String p2Id = p2.path("id").asText();
        long p2Version = p2.path("version").asLong();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> deleteFuture = pool.submit(() -> {
                try {
                    call(delete("/api/v1/authors/" + xId));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
                return null;
            });

            assertThat(raceContext.pause.await(10, TimeUnit.SECONDS))
                    .as("delete must reach removeFromAllPosts")
                    .isTrue();

            Future<ResultActions> putFuture = pool.submit(() -> {
                Map<String, Object> editP2 = new HashMap<>();
                editP2.put("title", "P2");
                editP2.put("content", doc("text"));
                editP2.put("authorIds", List.of(aliceId, xId, bobId));
                editP2.put("version", p2Version);
                return call(put("/api/v1/posts/" + p2Id), editP2);
            });

            Thread.sleep(500);
            raceContext.resume.countDown();
            deleteFuture.get(15, TimeUnit.SECONDS);

            // The PUT will fail (FK violation). We do not assert its HTTP status here
            // to stay agnostic of #70.
            try {
                putFuture.get(15, TimeUnit.SECONDS);
            } catch (Exception ignored) {
                // Expected: the PUT is rejected by the DB constraint.
            }

        } finally {
            raceContext.resume.countDown();
            pool.shutdownNow();
        }
        return p2Id;
    }

    @RepeatedTest(20)
    void deletingAnAuthorWhileAddingItToAPost_leavesNoPositionGap() throws Exception {
        String p2Id = executeRace();

        List<Integer> positions = jdbcTemplate.queryForList(
                "SELECT position FROM post_authors WHERE post_id = ? ORDER BY position",
                Integer.class,
                UUID.fromString(p2Id)
        );

        assertThat(positions)
                .as("P2 must not gain a position gap after the concurrent author deletion")
                .containsExactly(0, 1);
    }

    @RepeatedTest(20)
    void deletingAnAuthorWhileAddingItToAPost_returns200OnRead() throws Exception {
        String p2Id = executeRace();

        call(get("/api/v1/posts/" + p2Id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authors.length()").value(2))
                .andExpect(jsonPath("$.data.authors[0].name").value("Alice"))
                .andExpect(jsonPath("$.data.authors[1].name").value("Bob"))
                .andExpect(jsonPath("$.data.authors[*].name", not(hasItem("X"))));
    }
}
