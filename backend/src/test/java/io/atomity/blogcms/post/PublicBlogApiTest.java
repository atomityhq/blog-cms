package io.atomity.blogcms.post;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.IntegrationTest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PublicBlogApiTest extends IntegrationTest {

    private JsonNode createPost(String title, String... paragraphs) throws Exception {
        List<Map<String, Object>> content = new java.util.ArrayList<>();
        for (String text : paragraphs) {
            content.add(Map.of("type", "paragraph", "content", List.of(Map.of("type", "text", "text", text))));
        }
        Map<String, Object> body = Map.of("title", title, "content", Map.of("type", "doc", "content", content));
        return data(call(post("/api/v1/posts"), body).andExpect(status().isCreated()));
    }

    @Test
    void getBlogsReturnsOnlyPublishedPostsWithPagination() throws Exception {
        String draftId = createPost("Draft Post", "Draft content.").path("id").asText();
        
        String publishedId = createPost("Published Post", "Published content.").path("id").asText();
        call(post("/api/v1/posts/" + publishedId + "/publish")).andExpect(status().isOk());

        call(get("/api/v1/blogs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].title").value("Published Post"))
                .andExpect(jsonPath("$.meta.totalElements").value(1));
    }

    @Test
    void getBlogByIdReturnsPublishedPostOrNotFound() throws Exception {
        JsonNode created = createPost("My Blog", "Hello world.");
        String id = created.path("id").asText();
        
        call(get("/api/v1/blogs/" + id)).andExpect(status().isNotFound());

        call(post("/api/v1/posts/" + id + "/publish")).andExpect(status().isOk());

        call(get("/api/v1/blogs/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("My Blog"))
                .andExpect(jsonPath("$.data.content.content[0].content[0].text").value("Hello world."));

        call(post("/api/v1/posts/" + id + "/unpublish")).andExpect(status().isOk());
        call(get("/api/v1/blogs/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void nonExistentBlogReturnsNotFound() throws Exception {
        call(get("/api/v1/blogs/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isNotFound());
    }
}