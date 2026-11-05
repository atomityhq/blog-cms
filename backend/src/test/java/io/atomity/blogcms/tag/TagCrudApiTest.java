package io.atomity.blogcms.tag;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.IntegrationTest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

class TagCrudApiTest extends IntegrationTest {

    private JsonNode createTag(String name) throws Exception {
        return data(call(post("/api/v1/tags"), Map.of("name", name))
            .andExpect(status().isCreated()));
    }

    private JsonNode createPost(String title, String tagId) throws Exception {
        Map<String, Object> content = Map.of(
            "type", "doc",
            "content", List.of(
                Map.of("type", "paragraph",
                    "content", List.of(
                        Map.of("type", "text", "text", "Post body")
                    )
                )
            )
        );

        Map<String, Object> body = Map.of(
            "title", title,
            "content", content,
            "tagIds", List.of(tagId)
        );

        return data(call(post("/api/v1/posts"), body)
            .andExpect(status().isCreated()));
    }

    private long postCountFor(JsonNode tags, String tagId) {
        for (JsonNode tag : tags) {
            if (tag.path("id").asText().equals(tagId)) {
                return tag.path("postCount").asLong();
            }
        }

        throw new AssertionError("Tag not found in listing: " + tagId);
    }

    @Test
    void renameWithBlankSlugDerivesSlugFromNewName() throws Exception {
        String id = createTag("Alpha").path("id").asText();

        JsonNode renamed = data(call(put("/api/v1/tags/" + id), Map.of("name", "Beta Name", "slug", ""))
            .andExpect(status().isOk()));

        assertThat(renamed.path("name").asText()).isEqualTo("Beta Name");
        assertThat(renamed.path("slug").asText()).isEqualTo("beta-name");
    }

    @Test
    void renameMayKeepTheTagsOwnSlug() throws Exception {
        String id = createTag("Alpha").path("id").asText();

        // The slug "alpha" is only "taken" by this very tag, so this must not conflict.
        JsonNode renamed = data(call(put("/api/v1/tags/" + id), Map.of("name", "Alpha Renamed", "slug", "alpha"))
            .andExpect(status().isOk()));

        assertThat(renamed.path("name").asText()).isEqualTo("Alpha Renamed");
        assertThat(renamed.path("slug").asText()).isEqualTo("alpha");
    }

    @Test
    void renameIntoAnotherTagsSlugIsRejected() throws Exception {
        createTag("Alpha");
        String bravoId = createTag("Bravo").path("id").asText();

        call(put("/api/v1/tags/" + bravoId), Map.of("name", "Bravo", "slug", "alpha"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errors[0].errorCode").value("SLUG_TAKEN"));
    }

    @Test
    void renamingOrDeletingAnUnknownTagIsNotFound() throws Exception {
        String unknownId = UUID.randomUUID().toString();

        call(put("/api/v1/tags/" + unknownId), Map.of("name", "Ghost"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_FOUND"));

        call(delete("/api/v1/tags/" + unknownId))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_FOUND"));
    }

    @Test
    void handTypedSlugMustBeLowercaseKebabCase() throws Exception {
        for (String badSlug : List.of("Bad Slug!", "UPPER", "double--hyphen", "-leading", "trailing-")) {
            call(post("/api/v1/tags"), Map.of("name", "Valid name", "slug", badSlug))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].errorCode").value("VALIDATION_ERROR"));
        }
    }

    @Test
    void nameWithNoLettersOrDigitsNeedsAnExplicitSlug() throws Exception {
        call(post("/api/v1/tags"), Map.of("name", "!!!"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].errorCode").value("VALIDATION_ERROR"));

        JsonNode tag = data(call(post("/api/v1/tags"), Map.of("name", "!!!", "slug", "symbols"))
            .andExpect(status().isCreated()));

        assertThat(tag.path("slug").asText()).isEqualTo("symbols");
    }

    @Test
    void listReportsCorrectPostCountsForEachTag() throws Exception {
        String emptyTagId = createTag("Alpha empty").path("id").asText();
        String onePostTagId = createTag("Beta one").path("id").asText();
        String twoPostsTagId = createTag("Gamma two").path("id").asText();

        createPost("First post", onePostTagId);
        createPost("Second post", twoPostsTagId);
        createPost("Third post", twoPostsTagId);

        JsonNode tags = data(call(get("/api/v1/tags"))
            .andExpect(status().isOk()));

        assertThat(postCountFor(tags, emptyTagId)).isZero();
        assertThat(postCountFor(tags, onePostTagId)).isEqualTo(1);
        assertThat(postCountFor(tags, twoPostsTagId)).isEqualTo(2);
    }

}
