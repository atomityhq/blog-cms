package io.atomity.blogcms.post;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Map;

import static io.atomity.blogcms.post.PostApiTest.doc;
import static io.atomity.blogcms.post.PostApiTest.postBody;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The public blog API: published posts only, readable without signing in. */
class BlogApiTest extends IntegrationTest {

    // ── Builders ───────────────────────────────────────────────────────────

    /** Posts are set up through the admin API (signed in); the public API is then read anonymously. */
    private String createPost(String title, String... paragraphs) throws Exception {
        return data(call(post("/api/v1/posts"), postBody(title, doc(paragraphs))).andExpect(status().isCreated()))
                .path("id").asText();
    }

    private String createPublished(String title, String... paragraphs) throws Exception {
        String id = createPost(title, paragraphs);
        call(post("/api/v1/posts/" + id + "/publish")).andExpect(status().isOk());
        return id;
    }

    /** A request with no Authorization header, as a reader's browser or a public site would send. */
    private ResultActions anonymous(String url) throws Exception {
        return mockMvc.perform(get(url));
    }

    private JsonNode body(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    // ── List ───────────────────────────────────────────────────────────────

    @Test
    void listReturnsOnlyPublishedPostsNewestFirst() throws Exception {
        String older = createPublished("Older post", "First.");
        String newer = createPublished("Newer post", "Second.");
        createPost("Still a draft", "Not yet.");
        String archived = createPublished("Archived post", "Gone.");
        call(post("/api/v1/posts/" + archived + "/archive")).andExpect(status().isOk());

        JsonNode response = body(anonymous("/api/v1/blogs").andExpect(status().isOk()));

        JsonNode data = response.path("data");
        assertThat(data).hasSize(2);
        assertThat(data.get(0).path("id").asText()).isEqualTo(newer);
        assertThat(data.get(1).path("id").asText()).isEqualTo(older);
        assertThat(response.path("meta").path("totalElements").asLong()).isEqualTo(2);
    }

    @Test
    void listItemsLeaveOutBodyAndEditorialFields() throws Exception {
        createPublished("Summary only", "Body text.");

        anonymous("/api/v1/blogs")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].title").value("Summary only"))
                .andExpect(jsonPath("$.data[0].slug").value("summary-only"))
                .andExpect(jsonPath("$.data[0].publishedAt").isNotEmpty())
                .andExpect(jsonPath("$.data[0].content").doesNotExist())
                .andExpect(jsonPath("$.data[0].status").doesNotExist())
                .andExpect(jsonPath("$.data[0].version").doesNotExist());
    }

    @Test
    void listPaginates() throws Exception {
        createPublished("One", "a");
        createPublished("Two", "b");
        createPublished("Three", "c");

        anonymous("/api/v1/blogs?page=0&size=2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.meta.page").value(0))
                .andExpect(jsonPath("$.meta.size").value(2))
                .andExpect(jsonPath("$.meta.totalElements").value(3))
                .andExpect(jsonPath("$.meta.totalPages").value(2));

        anonymous("/api/v1/blogs?page=1&size=2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].title").value("One"))
                .andExpect(jsonPath("$.meta.page").value(1));
    }

    @Test
    void listWithNoPublishedPostsIsEmptyNotAnError() throws Exception {
        createPost("Only a draft", "text");

        anonymous("/api/v1/blogs")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0))
                .andExpect(jsonPath("$.meta.totalElements").value(0))
                .andExpect(jsonPath("$.meta.totalPages").value(1));
    }

    @Test
    void listClampsOutOfRangePaging() throws Exception {
        createPublished("Only", "text");

        anonymous("/api/v1/blogs?page=-3&size=500")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meta.page").value(0))
                .andExpect(jsonPath("$.meta.size").value(100))
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    void listRejectsNonNumericPaging() throws Exception {
        anonymous("/api/v1/blogs?page=abc")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].errorCode").value("BAD_REQUEST"));
    }

    @Test
    void listIgnoresStatusParameter() throws Exception {
        createPost("Secret draft", "text");

        anonymous("/api/v1/blogs?status=DRAFT")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ── Detail ─────────────────────────────────────────────────────────────

    @Test
    void getReturnsFullPublishedPost() throws Exception {
        String author = data(call(post("/api/v1/authors"), Map.of("name", "Lena")).andExpect(status().isCreated()))
                .path("id").asText();
        String tag = data(call(post("/api/v1/tags"), Map.of("name", "FinOps")).andExpect(status().isCreated()))
                .path("id").asText();
        Map<String, Object> request = postBody("Cutting cloud costs", doc("Rightsize first.", "Then commit."));
        request.put("authorIds", List.of(author));
        request.put("tagIds", List.of(tag));
        request.put("seoTitle", "Cut cloud costs in 2026");
        request.put("metaDescription", "Practical steps.");
        request.put("focusKeyword", "cloud costs");
        String id = data(call(post("/api/v1/posts"), request).andExpect(status().isCreated())).path("id").asText();
        call(post("/api/v1/posts/" + id + "/publish")).andExpect(status().isOk());

        anonymous("/api/v1/blogs/" + id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id))
                .andExpect(jsonPath("$.data.title").value("Cutting cloud costs"))
                .andExpect(jsonPath("$.data.slug").value("cutting-cloud-costs"))
                .andExpect(jsonPath("$.data.content.content[0].content[0].text").value("Rightsize first."))
                .andExpect(jsonPath("$.data.authors[0].name").value("Lena"))
                .andExpect(jsonPath("$.data.tags[0].name").value("FinOps"))
                .andExpect(jsonPath("$.data.seoTitle").value("Cut cloud costs in 2026"))
                .andExpect(jsonPath("$.data.metaDescription").value("Practical steps."))
                .andExpect(jsonPath("$.data.wordCount").value(4))
                .andExpect(jsonPath("$.data.publishedAt").isNotEmpty())
                // Editor-only fields stay private.
                .andExpect(jsonPath("$.data.status").doesNotExist())
                .andExpect(jsonPath("$.data.version").doesNotExist())
                .andExpect(jsonPath("$.data.focusKeyword").doesNotExist())
                .andExpect(jsonPath("$.data.createdAt").doesNotExist());
    }

    @Test
    void getHidesDraftsAsNotFound() throws Exception {
        String draft = createPost("Draft", "text");

        anonymous("/api/v1/blogs/" + draft)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_FOUND"));
    }

    @Test
    void getHidesUnpublishedAndArchivedPosts() throws Exception {
        String unpublished = createPublished("Pulled back", "text");
        anonymous("/api/v1/blogs/" + unpublished).andExpect(status().isOk());
        call(post("/api/v1/posts/" + unpublished + "/unpublish")).andExpect(status().isOk());
        anonymous("/api/v1/blogs/" + unpublished).andExpect(status().isNotFound());

        String archived = createPublished("Retired", "text");
        call(post("/api/v1/posts/" + archived + "/archive")).andExpect(status().isOk());
        anonymous("/api/v1/blogs/" + archived).andExpect(status().isNotFound());
    }

    @Test
    void getUnknownIdIsNotFound() throws Exception {
        anonymous("/api/v1/blogs/00000000-0000-0000-0000-000000000000")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_FOUND"));
    }

    @Test
    void getMalformedIdIsBadRequest() throws Exception {
        anonymous("/api/v1/blogs/not-a-uuid")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].errorCode").value("BAD_REQUEST"));
    }

    // ── Security ───────────────────────────────────────────────────────────

    @Test
    void publicRoutesDoNotOpenTheAdminApi() throws Exception {
        anonymous("/api/v1/posts").andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(postBody("Sneaky", doc("text")))))
                .andExpect(status().isUnauthorized());
        // Only GET is public on /blogs.
        mockMvc.perform(post("/api/v1/blogs").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
