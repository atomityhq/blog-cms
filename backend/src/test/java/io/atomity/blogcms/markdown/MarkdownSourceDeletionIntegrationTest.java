package io.atomity.blogcms.markdown;

import io.atomity.blogcms.IntegrationTest;
import io.atomity.blogcms.markdown.repository.MarkdownSourceRepository;
import io.atomity.blogcms.markdown.service.MarkdownSourceService;
import io.atomity.blogcms.media.storage.StorageService;
import io.atomity.blogcms.shared.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real PostgreSQL transactions and row locks; only remote storage failures are injected. */
class MarkdownSourceDeletionIntegrationTest extends IntegrationTest {
    @Autowired private MarkdownSourceRepository repository;
    @Autowired private MarkdownSourceService sources;
    @Autowired private StorageService storage;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private jakarta.persistence.EntityManager entityManager;

    private UUID upload() {
        return sources.upload(new MockMultipartFile("file", "race.md", "text/markdown",
                "# Race".getBytes(StandardCharsets.UTF_8))).id();
    }

    private static Map<String, Object> postBody(UUID id) {
        return Map.of("title", "Imported", "markdownSourceId", id,
                "content", Map.of("type", "doc", "content", List.of()));
    }

    @Test
    void storageFailureCommitsPendingStateAndTheSameIdCanBeRetried() throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        StorageService remote = spy(storage);
        var deletion = new MarkdownSourceService(repository, remote, transactionManager, entityManager);
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MEDIA_STORAGE_UNAVAILABLE", "Try again");
        }).doCallRealMethod().when(remote).deleteRequired(key);

        assertThatThrownBy(() -> deletion.delete(id)).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.getErrorCode()).isEqualTo("MEDIA_STORAGE_UNAVAILABLE"));
        assertThat(repository.findById(id).orElseThrow().isDeletionPending()).isTrue();
        assertThat(storage.load(key)).isNotNull();
        call(get("/api/v1/markdown-sources/" + id + "/file")).andExpect(status().isNotFound());
        call(post("/api/v1/posts"), postBody(id)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].errorCode").value("SOURCE_DELETION_PENDING"));

        deletion.delete(id);
        assertThat(repository.existsById(id)).isFalse();
        assertThatThrownBy(() -> storage.load(key)).isInstanceOf(ApiException.class);
        verify(remote, times(2)).deleteRequired(key);
    }

    @Test
    void attachmentIsRejectedWhileRemoteDeletionIsStillRunning() throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        StorageService remote = spy(storage);
        var deletion = new MarkdownSourceService(repository, remote, transactionManager, entityManager);
        var deleting = new CountDownLatch(1);
        var finish = new CountDownLatch(1);
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            deleting.countDown();
            assertThat(finish.await(10, TimeUnit.SECONDS)).isTrue();
            return invocation.callRealMethod();
        }).when(remote).deleteRequired(key);

        var executor = Executors.newSingleThreadExecutor();
        try {
            var result = executor.submit(() -> deletion.delete(id));
            assertThat(deleting.await(10, TimeUnit.SECONDS)).isTrue();
            // A separate HTTP request sees committed pending state before the network call finishes.
            assertThat(repository.findById(id).orElseThrow().isDeletionPending()).isTrue();
            call(post("/api/v1/posts"), postBody(id)).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.errors[0].errorCode").value("SOURCE_DELETION_PENDING"));
            finish.countDown();
            result.get(10, TimeUnit.SECONDS);
            assertThat(repository.existsById(id)).isFalse();
        } finally {
            finish.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void deletionWaitsForAnAttachmentTransactionAndThenProtectsTheFile() throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        var attached = new CountDownLatch(1);
        var commit = new CountDownLatch(1);
        // Authenticate before starting worker threads, keeping the shared token helper single threaded.
        token();
        var executor = Executors.newFixedThreadPool(2);
        try {
            var attachment = executor.submit(() -> new TransactionTemplate(transactionManager)
                    .executeWithoutResult(status -> {
                        try {
                            call(post("/api/v1/posts"), postBody(id)).andExpect(status().isCreated());
                            attached.countDown();
                            assertThat(commit.await(10, TimeUnit.SECONDS)).isTrue();
                        } catch (Exception ex) {
                            throw new IllegalStateException(ex);
                        }
                    }));
            assertThat(attached.await(10, TimeUnit.SECONDS)).isTrue();
            var deletion = executor.submit(() -> sources.delete(id));
            // Observe a real PostgreSQL lock wait instead of assuming a timed sleep proves blocking.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            boolean blocked = false;
            while (System.nanoTime() < deadline) {
                blocked = Boolean.TRUE.equals(jdbc.queryForObject("""
                        SELECT EXISTS (SELECT 1 FROM pg_stat_activity
                        WHERE cardinality(pg_blocking_pids(pid)) > 0
                          AND query LIKE '%markdown_sources%')
                        """, Boolean.class));
                if (blocked) break;
                Thread.sleep(20);
            }
            assertThat(blocked).as("DELETE waits for the post attachment row lock").isTrue();
            assertThat(deletion.isDone()).isFalse();
            commit.countDown();
            attachment.get(10, TimeUnit.SECONDS);
            assertThatThrownBy(() -> deletion.get(10, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex.getCause()).getErrorCode())
                            .isEqualTo("MARKDOWN_SOURCE_IN_USE"));
            assertThat(repository.findById(id).orElseThrow().isDeletionPending()).isFalse();
            assertThat(storage.load(key)).isNotNull();
        } finally {
            commit.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void concurrentDeletesOfTheSameSourceBothComplete(boolean secondFinishesFirst) throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        StorageService remote = spy(storage);
        var deletion = new MarkdownSourceService(repository, remote, transactionManager, entityManager);
        var entered = new CountDownLatch[] {new CountDownLatch(1), new CountDownLatch(1)};
        var release = new CountDownLatch[] {new CountDownLatch(1), new CountDownLatch(1)};
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(invocation -> {
            int index = calls.getAndIncrement();
            entered[index].countDown();
            assertThat(release[index].await(10, TimeUnit.SECONDS)).isTrue();
            return invocation.callRealMethod();
        }).when(remote).deleteRequired(key);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> deletion.delete(id));
            assertThat(entered[0].await(10, TimeUnit.SECONDS)).isTrue();
            var second = executor.submit(() -> deletion.delete(id));
            assertThat(entered[1].await(10, TimeUnit.SECONDS)).isTrue();
            assertThat(repository.findById(id).orElseThrow().isDeletionPending()).isTrue();
            int winner = secondFinishesFirst ? 1 : 0;
            release[winner].countDown();
            (secondFinishesFirst ? second : first).get(10, TimeUnit.SECONDS);
            assertThat(repository.existsById(id)).isFalse();
            assertThat((secondFinishesFirst ? first : second).isDone()).isFalse();
            release[1 - winner].countDown();
            (secondFinishesFirst ? first : second).get(10, TimeUnit.SECONDS);
            assertThat(repository.existsById(id)).isFalse();
            assertThatThrownBy(() -> storage.load(key)).isInstanceOf(ApiException.class);
            verify(remote, times(2)).deleteRequired(key);
        } finally {
            release[0].countDown();
            release[1].countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void concurrentMetadataCleanupIsSafeWhenBothDeletesWaitOnTheSameRow() throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        StorageService remote = spy(storage);
        var deletion = new MarkdownSourceService(repository, remote, transactionManager, entityManager);
        var inStorage = new CountDownLatch(2);
        var finishStorage = new CountDownLatch(1);
        doAnswer(invocation -> {
            inStorage.countDown();
            assertThat(finishStorage.await(10, TimeUnit.SECONDS)).isTrue();
            return invocation.callRealMethod();
        }).when(remote).deleteRequired(key);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> deletion.delete(id));
            var second = executor.submit(() -> deletion.delete(id));
            assertThat(inStorage.await(10, TimeUnit.SECONDS)).isTrue();
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                // Hold the row until both final DELETE statements actually wait on it.
                sources.lockForPostChange(id, null);
                finishStorage.countDown();
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                while (System.nanoTime() < deadline) {
                    Long waiting = jdbc.queryForObject("""
                            SELECT count(*) FROM pg_stat_activity
                            WHERE cardinality(pg_blocking_pids(pid)) > 0
                              AND lower(query) LIKE '%delete%markdown_sources%'
                            """, Long.class);
                    if (waiting != null && waiting >= 2) return;
                    try { Thread.sleep(20); }
                    catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException(ex);
                    }
                }
                fail("Both final metadata deletes must reach a real PostgreSQL lock wait");
            });
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
            assertThat(repository.existsById(id)).isFalse();
            assertThatThrownBy(() -> storage.load(key)).isInstanceOf(ApiException.class);
        } finally {
            finishStorage.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

}
