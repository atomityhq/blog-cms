package io.atomity.blogcms.markdown;

import io.atomity.blogcms.markdown.controller.MarkdownSourceController;
import io.atomity.blogcms.markdown.service.MarkdownSourceService;
import io.atomity.blogcms.media.storage.StorageService;
import io.atomity.blogcms.shared.ApiException;
import io.atomity.blogcms.shared.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** HTTP routing and error envelopes without requiring a database. */
class MarkdownSourceControllerTest {
    private final MarkdownSourceService service = mock(MarkdownSourceService.class);
    private final UUID id = UUID.randomUUID();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new MarkdownSourceController(service, mock(StorageService.class)))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void deleteReturnsNoContent() throws Exception {
        mvc.perform(delete("/api/v1/markdown-sources/" + id))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        verify(service).delete(id);
    }

    @Test
    void referencedSourceReturnsConflictEnvelope() throws Exception {
        doThrow(ApiException.conflict("SOURCE_IN_USE", "Still used" )).when(service).delete(id);
        mvc.perform(delete("/api/v1/markdown-sources/" + id))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errors[0].errorCode").value("SOURCE_IN_USE"));
    }

    @Test
    void storageFailureReturnsServiceUnavailable() throws Exception {
        doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Try again"))
                .when(service).delete(id);
        mvc.perform(delete("/api/v1/markdown-sources/" + id))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errors[0].errorCode").value("STORAGE_UNAVAILABLE"));
    }

    @Test
    void unknownIdReturnsNotFound() throws Exception {
        doThrow(ApiException.notFound("Markdown file")).when(service).delete(id);
        mvc.perform(delete("/api/v1/markdown-sources/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void malformedIdReturnsBadRequest() throws Exception {
        mvc.perform(delete("/api/v1/markdown-sources/not-a-uuid")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
