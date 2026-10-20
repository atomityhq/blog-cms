package io.atomity.blogcms.blog;

import io.atomity.blogcms.IntegrationTest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BlogApiTest extends IntegrationTest {

    // ── Builders ───────────────────────────────────────────────────────────

    private String createPost(String title) throws Exception {
        Map<String, Object> content = Map.of("type", "doc", "content", List.of(
                Map.of("type", "paragraph", "content", List.of(Map.of("type", "text", "text", "Some words.")))));
        return data(call(post("/api/v1/posts"), Map.of("title", title, "content", content))
                .andExpect(status().isCreated())).path("id").asText();
    }

    private String createPublishedPost(String title) throws Exception {
        String id = createPost(title);
        call(post("/api/v1/posts/" + id + "/publish")).andExpect(status().isOk());
        return id;
    }

    // ── List ───────────────────────────────────────────────────────────────

    @Test
    void listShowsOnlyPublishedPostsNewestFirst() throws Exception {
        createPublishedPost("Older");
        createPublishedPost("Newer");
        createPost("Draft");
        String archived = createPublishedPost("Archived");
        call(post("/api/v1/posts/" + archived + "/archive")).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/blogs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].title").value("Newer"))
                .andExpect(jsonPath("$.data[1].title").value("Older"))
                .andExpect(jsonPath("$.data[0].content").doesNotExist())
                .andExpect(jsonPath("$.data[0].status").doesNotExist())
                .andExpect(jsonPath("$.meta.totalElements").value(2));
    }

    @Test
    void listPaginatesAndCapsThePageNumber() throws Exception {
        createPublishedPost("One");
        createPublishedPost("Two");
        createPublishedPost("Three");

        mockMvc.perform(get("/api/v1/blogs").param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].title").value("One"))
                .andExpect(jsonPath("$.meta.page").value(1))
                .andExpect(jsonPath("$.meta.size").value(2))
                .andExpect(jsonPath("$.meta.totalElements").value(3))
                .andExpect(jsonPath("$.meta.totalPages").value(2));

        mockMvc.perform(get("/api/v1/blogs").param("page", "999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0))
                .andExpect(jsonPath("$.meta.page").value(1000));
    }

    @Test
    void listUsesTheAdminSortRules() throws Exception {
        createPublishedPost("Older");
        createPublishedPost("Newer");

        mockMvc.perform(get("/api/v1/blogs").param("direction", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].title").value("Older"));

        mockMvc.perform(get("/api/v1/blogs").param("sort", "focusKeyword"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].errorCode").value("BAD_REQUEST"));
    }

    // ── Single post ────────────────────────────────────────────────────────

    @Test
    void publishedPostIsReadableByIdAndBySlug() throws Exception {
        String id = createPublishedPost("Hello public");

        for (String path : List.of("/api/v1/blogs/" + id, "/api/v1/blogs/slug/hello-public")) {
            mockMvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.id").value(id))
                    .andExpect(jsonPath("$.data.title").value("Hello public"))
                    .andExpect(jsonPath("$.data.content.content[0].content[0].text").value("Some words."))
                    .andExpect(jsonPath("$.data.publishedAt").isNotEmpty())
                    .andExpect(jsonPath("$.data.status").doesNotExist())
                    .andExpect(jsonPath("$.data.version").doesNotExist())
                    .andExpect(jsonPath("$.data.focusKeyword").doesNotExist());
        }

    }

    /**
     * A post that was published and then taken down keeps publishedAt, but must not be public.
     */
    @Test
    void unpublishedPostsAnswerLikeMissingOnes() throws Exception {
        String draft = createPost("A draft");
        String archived = createPublishedPost("Archived");
        call(post("/api/v1/posts/" + archived + "/archive")).andExpect(status().isOk());
        String takenDown = createPublishedPost("Taken down");
        call(post("/api/v1/posts/" + takenDown + "/unpublish")).andExpect(status().isOk());

        for (String path : List.of(
                "/api/v1/blogs/" + draft, "/api/v1/blogs/slug/a-draft",
                "/api/v1/blogs/" + archived, "/api/v1/blogs/slug/archived",
                "/api/v1/blogs/" + takenDown, "/api/v1/blogs/slug/taken-down",
                "/api/v1/blogs/" + UUID.randomUUID(), "/api/v1/blogs/slug/no-such-post")) {
            mockMvc.perform(get(path))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_FOUND"));
        }

        mockMvc.perform(get("/api/v1/blogs"))
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ── Access ─────────────────────────────────────────────────────────────

    @Test
    void onlyReadsArePublic() throws Exception {
        mockMvc.perform(post("/api/v1/blogs"))
                .andExpect(status().isUnauthorized());
    }
}
