package io.atomity.blogcms.author;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.IntegrationTest;
import io.atomity.blogcms.author.repository.AuthorRepository;
import io.atomity.blogcms.post.repository.PostRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

import java.lang.reflect.InvocationTargetException;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
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
                        if (method.getName().equals("findPostIds") && context.pauseOnFindPostIds) {
                            Object result;
                            try {
                                result = method.invoke(real, args);
                            } catch (InvocationTargetException e) {
                                throw e.getCause();
                            }
                            context.deletePaused.countDown();
                            try {
                                context.deleteResume.await(10, TimeUnit.SECONDS);
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                            }
                            return result;
                        }
                        try {
                            return method.invoke(real, args);
                        } catch (InvocationTargetException e) {
                            throw e.getCause();
                        }
                    }
            );
        }

        @Bean
        @Primary
        public PostRepository racePostRepository(PostRepository real, RaceContext context) {
            return (PostRepository) Proxy.newProxyInstance(
                    PostRepository.class.getClassLoader(),
                    new Class<?>[]{PostRepository.class},
                    (proxy, method, args) -> {
                        if (method.getName().equals("saveAndFlush") && context.pauseOnSaveAndFlush) {
                            context.putReachedSave.countDown();
                            try {
                                context.putResume.await(10, TimeUnit.SECONDS);
                            } catch (InterruptedException e) {
                                Thread.currentThread().interrupt();
                            }
                        }
                        try {
                            return method.invoke(real, args);
                        } catch (InvocationTargetException e) {
                            throw e.getCause();
                        }
                    }
            );
        }

        @Bean
        public RaceContext raceContext() {
            return new RaceContext();
        }
    }

    public static class RaceContext {
        public CountDownLatch deletePaused;
        public CountDownLatch deleteResume;
        public boolean pauseOnFindPostIds;

        public CountDownLatch putReachedSave;
        public CountDownLatch putResume;
        public boolean pauseOnSaveAndFlush;

        public RaceContext() {
            reset();
        }

        public void reset() {
            deletePaused = new CountDownLatch(1);
            deleteResume = new CountDownLatch(1);
            pauseOnFindPostIds = false;

            putReachedSave = new CountDownLatch(1);
            putResume = new CountDownLatch(1);
            pauseOnSaveAndFlush = false;
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

    private List<Integer> getPositions(String postId) {
        return jdbcTemplate.queryForList(
                "SELECT position FROM post_authors WHERE post_id = ? ORDER BY position",
                Integer.class,
                UUID.fromString(postId)
        );
    }

    @Test
    void concurrentDelete_returns409ForLoser() throws Exception {
        String authorId = createAuthor("ToDelete");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);

        try {
            Future<ResultActions> f1 = pool.submit(() -> {
                start.await();
                return call(delete("/api/v1/authors/" + authorId));
            });
            Future<ResultActions> f2 = pool.submit(() -> {
                start.await();
                return call(delete("/api/v1/authors/" + authorId));
            });

            start.countDown();

            ResultActions r1 = f1.get(10, TimeUnit.SECONDS);
            ResultActions r2 = f2.get(10, TimeUnit.SECONDS);

            int status1 = r1.andReturn().getResponse().getStatus();
            int status2 = r2.andReturn().getResponse().getStatus();

            assertThat(List.of(status1, status2))
                    .containsExactlyInAnyOrder(204, 409);
        } finally {
            pool.shutdownNow();
        }
    }

    private String executeRace(boolean putWins) throws Exception {
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
            raceContext.pauseOnFindPostIds = true;
            raceContext.pauseOnSaveAndFlush = true;

            if (putWins) {
                Future<ResultActions> putFuture = pool.submit(() -> {
                    Map<String, Object> editP2 = new HashMap<>();
                    editP2.put("title", "P2");
                    editP2.put("content", doc("text"));
                    editP2.put("authorIds", List.of(aliceId, xId, bobId));
                    editP2.put("version", p2Version);
                    return call(put("/api/v1/posts/" + p2Id), editP2);
                });

                assertTrue(raceContext.putReachedSave.await(10, TimeUnit.SECONDS), "PUT did not reach saveAndFlush");
                raceContext.putResume.countDown();
                putFuture.get(15, TimeUnit.SECONDS).andExpect(status().isOk());

                Future<?> deleteFuture = pool.submit(() -> {
                    call(delete("/api/v1/authors/" + xId));
                    return null;
                });
                raceContext.deleteResume.countDown();
                deleteFuture.get(15, TimeUnit.SECONDS);
            } else {
                Future<?> deleteFuture = pool.submit(() -> {
                    call(delete("/api/v1/authors/" + xId));
                    return null;
                });

                assertTrue(raceContext.deletePaused.await(10, TimeUnit.SECONDS), "DELETE did not reach findPostIds");

                Future<ResultActions> putFuture = pool.submit(() -> {
                    Map<String, Object> editP2 = new HashMap<>();
                    editP2.put("title", "P2");
                    editP2.put("content", doc("text"));
                    editP2.put("authorIds", List.of(aliceId, xId, bobId));
                    editP2.put("version", p2Version);
                    return call(put("/api/v1/posts/" + p2Id), editP2);
                });

                assertTrue(raceContext.putReachedSave.await(10, TimeUnit.SECONDS), "PUT did not reach saveAndFlush");

                raceContext.deleteResume.countDown();
                deleteFuture.get(15, TimeUnit.SECONDS);

                raceContext.putResume.countDown();

                ResultActions putResult = putFuture.get(15, TimeUnit.SECONDS);
                int statusCode = putResult.andReturn().getResponse().getStatus();
                String responseBody = putResult.andReturn().getResponse().getContentAsString();

                if (statusCode != 409) {
                    throw new RuntimeException("Expected 409 but got " + statusCode + ". Body: " + responseBody);
                }
            }

        } finally {
            raceContext.deleteResume.countDown();
            raceContext.putResume.countDown();
            pool.shutdownNow();
        }
        return p2Id;
    }

    @Test
    void deleteWins_leavesNoPositionGap() throws Exception {
        String p2Id = executeRace(false);
        assertThat(getPositions(p2Id)).containsExactly(0, 1);
    }

    @Test
    void deleteWins_returns200OnRead() throws Exception {
        String p2Id = executeRace(false);
        call(get("/api/v1/posts/" + p2Id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authors.length()").value(2))
                .andExpect(jsonPath("$.data.authors[0].name").value("Alice"))
                .andExpect(jsonPath("$.data.authors[1].name").value("Bob"));
    }

    @Test
    void putWins_removesAuthorAndLeavesNoGap() throws Exception {
        String p2Id = executeRace(true);
        assertThat(getPositions(p2Id)).containsExactly(0, 1);
        call(get("/api/v1/posts/" + p2Id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authors.length()").value(2));
    }
}
