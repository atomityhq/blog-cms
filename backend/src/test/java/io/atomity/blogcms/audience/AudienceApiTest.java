package io.atomity.blogcms.audience;

import com.fasterxml.jackson.databind.JsonNode;
import io.atomity.blogcms.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AudienceApiTest extends IntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String createAudience(String name) throws Exception {
        return data(call(post("/api/v1/audiences"), Map.of("name", name))
                .andExpect(status().isCreated())).path("id").asText();
    }

    private Map<String, Object> body(List<String> primary, List<String> secondary) {
        var body = new HashMap<String, Object>();
        body.put("title", "Audience targeting");
        body.put("content", Map.of("type", "doc", "content", List.of(Map.of("type", "paragraph",
                "content", List.of(Map.of("type", "text", "text", "A useful article"))))));
        body.put("primaryAudienceIds", primary);
        body.put("secondaryAudienceIds", secondary);
        return body;
    }

    @Test
    void managesReusableAudienceLabels() throws Exception {
        String audience = createAudience("  Technology leaders  ");
        createAudience("Business teams");
        call(get("/api/v1/audiences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Business teams"))
                .andExpect(jsonPath("$.data[1].name").value("Technology leaders"))
                .andExpect(jsonPath("$.data[1].slug").value("technology-leaders"))
                .andExpect(jsonPath("$.data[1].postCount").value(0));
        call(put("/api/v1/audiences/" + audience), Map.of("name", "Engineering teams", "slug", "engineering"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Engineering teams"))
                .andExpect(jsonPath("$.data.slug").value("engineering"));
        call(delete("/api/v1/audiences/" + audience)).andExpect(status().isNoContent());
        call(delete("/api/v1/audiences/" + audience)).andExpect(status().isNotFound());
        call(put("/api/v1/audiences/" + audience), Map.of("name", "Missing"))
                .andExpect(status().isNotFound());
    }

    @Test
    void validatesAudienceNamesAndSlugs() throws Exception {
        for (Map<String, String> invalid : List.of(Map.of("name", " "), Map.of("name", "x".repeat(101)),
                Map.of("name", "Teams\0Name"),
                Map.of("name", "Teams", "slug", "Bad Slug"), Map.of("name", "Teams", "slug", "x".repeat(121)))) {
            call(post("/api/v1/audiences"), invalid).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].errorCode").value("VALIDATION_ERROR"));
        }
        createAudience("Teams");
        call(post("/api/v1/audiences"), Map.of("name", "Other", "slug", "teams"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].errorCode").value("SLUG_TAKEN"));
        String other = createAudience("Other");
        call(put("/api/v1/audiences/" + other), Map.of("name", "Other", "slug", "teams"))
                .andExpect(status().isConflict());
    }

    @Test
    void audienceEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/audiences")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/audiences")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/v1/audiences/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/v1/audiences/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

}
