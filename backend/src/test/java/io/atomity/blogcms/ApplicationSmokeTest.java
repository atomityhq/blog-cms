package io.atomity.blogcms;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Cross-cutting plumbing every feature relies on: health, error envelope, correlation IDs. */
@ExtendWith(OutputCaptureExtension.class)
class ApplicationSmokeTest extends IntegrationTest {

    @Test
    void readinessIsPublicAndReportsUp() throws Exception {
        mockMvc.perform(get("/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void unknownPathReturns404InErrorEnvelope() throws Exception {
        call(get("/api/v1/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_FOUND"))
                .andExpect(jsonPath("$.errors[0].correlationId").isNotEmpty());
    }

    @Test
    void wrongContentTypeReturns415WithoutErrorLog(CapturedOutput output) throws Exception {
        call(post("/api/v1/posts").contentType(MediaType.TEXT_PLAIN).content("Hello"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.errors[0].errorCode").value("UNSUPPORTED_MEDIA_TYPE"));
        assertThat(output.getOut()).doesNotContain("Unhandled exception");
    }

    @Test
    void jsonSentToImageUploadReturns415() throws Exception {
        call(post("/api/v1/media").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.errors[0].errorCode").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void unsupportedAcceptReturns406WithoutErrorLog(CapturedOutput output) throws Exception {
        call(get("/api/v1/posts").accept(MediaType.APPLICATION_XML))
                .andExpect(status().isNotAcceptable())
                .andExpect(jsonPath("$.errors[0].errorCode").value("NOT_ACCEPTABLE"));
        assertThat(output.getOut()).doesNotContain("Unhandled exception");
    }

    @Test
    void echoesSafeCorrelationId() throws Exception {
        mockMvc.perform(get("/health/liveness").header("X-Correlation-ID", "abc-123"))
                .andExpect(header().string("X-Correlation-ID", "abc-123"));
    }

    @Test
    void replacesUnsafeCorrelationId() throws Exception {
        mockMvc.perform(get("/health/liveness").header("X-Correlation-ID", "bad\nid"))
                .andExpect(header().string("X-Correlation-ID", matchesPattern("[0-9a-f-]{36}")));
    }
}
