package io.atomity.blogcrm;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Boots the full application against a real Postgres (Flyway included) and
 * checks the cross-cutting plumbing every feature relies on.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ApplicationSmokeTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void readinessReportsDatabaseUp() throws Exception {
        mockMvc.perform(get("/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void unknownPathReturns404InErrorEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_FOUND"))
                .andExpect(jsonPath("$.errors[0].correlationId").isNotEmpty());
    }

    @Test
    void echoesSafeCorrelationId() throws Exception {
        mockMvc.perform(get("/health/liveness").header("X-Correlation-ID", "abc-123"))
                .andExpect(header().string("X-Correlation-ID", "abc-123"));
    }

    @Test
    void replacesUnsafeCorrelationId() throws Exception {
        mockMvc.perform(get("/health/liveness").header("X-Correlation-ID", "bad\nid"))
                .andExpect(header().string("X-Correlation-ID",
                        matchesPattern("[0-9a-f-]{36}")));
    }
}
