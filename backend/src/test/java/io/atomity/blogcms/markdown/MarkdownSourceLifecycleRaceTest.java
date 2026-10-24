package io.atomity.blogcms.markdown;

import io.atomity.blogcms.IntegrationTest;
import io.atomity.blogcms.markdown.entity.MarkdownSource;
import io.atomity.blogcms.markdown.repository.MarkdownSourceRepository;
import io.atomity.blogcms.markdown.service.MarkdownSourceService;
import io.atomity.blogcms.media.storage.StorageService;
import io.atomity.blogcms.post.dto.PostRequest;
import io.atomity.blogcms.post.dto.PostResponse;
import io.atomity.blogcms.post.service.PostService;
import io.atomity.blogcms.shared.ApiException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Exercise every reference writer and automatic cleanup using actual PostgreSQL locks. */
class MarkdownSourceLifecycleRaceTest extends IntegrationTest {
    @Autowired private MarkdownSourceRepository repository;
    @Autowired private MarkdownSourceService sources;
    @Autowired private PostService posts;
    @Autowired private StorageService storage;
    @Autowired private PlatformTransactionManager manager;
    @Autowired private EntityManager entityManager;
    @Autowired private JdbcTemplate jdbc;

    private UUID upload() {
        return sources.upload(new MockMultipartFile("file", "source.md", "text/markdown",
                "# Original".getBytes(StandardCharsets.UTF_8))).id();
    }

    private PostRequest input(UUID source, Long version) {
        Map<String, Object> values = new HashMap<>();
        values.put("title", "Post " + UUID.randomUUID());
        values.put("content", Map.of("type", "doc", "content", List.of()));
        values.put("markdownSourceId", source);
        values.put("version", version);
        return objectMapper.convertValue(values, PostRequest.class);
    }

    private void cleanup(String action, PostResponse original, UUID replacement) {
        if (action.equals("delete")) posts.delete(original.id());
        else posts.update(original.id(), input(action.equals("replace") ? replacement : null, original.version()));
    }

    private void assertCleanupSaved(String action, PostResponse original, UUID replacement) {
        if (action.equals("delete")) {
            assertThatThrownBy(() -> posts.get(original.id())).isInstanceOf(ApiException.class);
        } else {
            PostResponse saved = posts.get(original.id());
            assertThat(saved.version()).isGreaterThan(original.version());
            if (action.equals("replace")) assertThat(saved.markdownSource().id()).isEqualTo(replacement);
            else assertThat(saved.markdownSource()).isNull();
        }
    }

    private void await(CountDownLatch latch) {
        try {
            assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(ex);
        }
    }

    private void awaitSourceLockWait() throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            if (Boolean.TRUE.equals(jdbc.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM pg_stat_activity
                    WHERE cardinality(pg_blocking_pids(pid)) > 0 AND query LIKE '%markdown_sources%')
                    """, Boolean.class))) return;
            Thread.sleep(20);
        }
        fail("Expected a real PostgreSQL Markdown source lock wait");
    }

    private void stop(ExecutorService executor, CountDownLatch release) throws Exception {
        release.countDown();
        executor.shutdownNow();
        assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"remove,create", "remove,update", "replace,create", "replace,update", "delete,create", "delete,update"})
    void automaticCleanupWaitsForAnAttachmentAndPreservesTheSavedChanges(String action, String writer) throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        UUID replacement = action.equals("replace") ? upload() : null;
        PostResponse original = posts.create(input(id, null));
        PostResponse target = writer.equals("update") ? posts.create(input(null, null)) : null;
        var attached = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var attachment = executor.submit(() -> new TransactionTemplate(manager).execute(status -> {
                PostResponse attachedPost = target == null ? posts.create(input(id, null))
                        : posts.update(target.id(), input(id, target.version()));
                attached.countDown();
                await(release);
                return attachedPost;
            }));
            await(attached);
            var cleaning = executor.submit(() -> cleanup(action, original, replacement));
            awaitSourceLockWait();
            assertThat(cleaning.isDone()).isFalse();
            release.countDown();
            PostResponse attachedPost = attachment.get(10, TimeUnit.SECONDS);
            cleaning.get(10, TimeUnit.SECONDS);
            assertCleanupSaved(action, original, replacement);
            assertThat(posts.get(attachedPost.id()).markdownSource().id()).isEqualTo(id);
            assertThat(repository.countUsages(id)).isEqualTo(1);
            assertThat(storage.load(key)).isNotNull();
        } finally {
            stop(executor, release);
        }
    }

    @ParameterizedTest
    @CsvSource({"remove,create", "remove,update", "replace,create", "replace,update", "delete,create", "delete,update"})
    void attachmentWaitsForAutomaticCleanupAndFailsCleanlyAfterItWins(String action, String writer) throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        UUID replacement = action.equals("replace") ? upload() : null;
        PostResponse original = posts.create(input(id, null));
        PostResponse target = writer.equals("update") ? posts.create(input(null, null)) : null;
        var cleaned = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var cleaning = executor.submit(() -> new TransactionTemplate(manager).executeWithoutResult(status -> {
                cleanup(action, original, replacement);
                cleaned.countDown();
                await(release);
            }));
            await(cleaned);
            // Remote files are untouched until the post change commits.
            assertThat(storage.load(key)).isNotNull();
            var attachment = executor.submit(() -> target == null ? posts.create(input(id, null))
                    : posts.update(target.id(), input(id, target.version())));
            awaitSourceLockWait();
            release.countDown();
            cleaning.get(10, TimeUnit.SECONDS);
            assertThatThrownBy(() -> attachment.get(10, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex.getCause()).getErrorCode()).isEqualTo("UNKNOWN_REFERENCE"));
            assertCleanupSaved(action, original, replacement);
            assertThat(repository.existsById(id)).isFalse();
            assertThatThrownBy(() -> storage.load(key)).isInstanceOf(ApiException.class);
        } finally {
            stop(executor, release);
        }
    }

    @Test
    void duplicateWaitsForCleanupAndRejectsAStaleSourceWithoutAForeignKeyFailure() throws Exception {
        UUID id = upload();
        PostResponse original = posts.create(input(id, null));
        var removed = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var cleaning = executor.submit(() -> new TransactionTemplate(manager).executeWithoutResult(status -> {
                posts.delete(original.id());
                removed.countDown();
                await(release);
            }));
            await(removed);
            // The other transaction can still read the old post while its deletion is uncommitted.
            var duplicate = executor.submit(() -> posts.duplicate(original.id()));
            awaitSourceLockWait();
            release.countDown();
            cleaning.get(10, TimeUnit.SECONDS);
            assertThatThrownBy(() -> duplicate.get(10, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(ApiException.class)
                    .satisfies(ex -> assertThat(((ApiException) ex.getCause()).getErrorCode()).isEqualTo("UNKNOWN_REFERENCE"));
            assertThat(repository.existsById(id)).isFalse();
        } finally {
            stop(executor, release);
        }
    }

    @Test
    void cleanupWaitsForDuplicateAndKeepsItsSharedSource() throws Exception {
        UUID id = upload();
        PostResponse original = posts.create(input(id, null));
        var copied = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var duplicate = executor.submit(() -> new TransactionTemplate(manager).execute(status -> {
                PostResponse copy = posts.duplicate(original.id());
                copied.countDown();
                await(release);
                return copy;
            }));
            await(copied);
            var cleaning = executor.submit(() -> posts.delete(original.id()));
            awaitSourceLockWait();
            release.countDown();
            PostResponse copy = duplicate.get(10, TimeUnit.SECONDS);
            cleaning.get(10, TimeUnit.SECONDS);
            assertThat(posts.get(copy.id()).markdownSource().id()).isEqualTo(id);
            assertThat(repository.countUsages(id)).isEqualTo(1);
        } finally {
            stop(executor, release);
        }
    }

    @Test
    void aCachedSourceIsRefreshedBeforeCheckingPendingDeletion() throws Exception {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        StorageService remote = spy(storage);
        var deletion = new MarkdownSourceService(repository, remote, manager, entityManager);
        var deleting = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(invocation -> {
            deleting.countDown();
            await(release);
            return invocation.callRealMethod();
        }).when(remote).deleteRequired(key);
        var executor = Executors.newSingleThreadExecutor();
        java.util.concurrent.atomic.AtomicReference<Future<?>> worker = new java.util.concurrent.atomic.AtomicReference<>();
        try {
            new TransactionTemplate(manager).executeWithoutResult(status -> {
                MarkdownSource cached = repository.findById(id).orElseThrow();
                assertThat(cached.isDeletionPending()).isFalse();
                worker.set(executor.submit(() -> deletion.delete(id)));
                await(deleting);
                assertThatThrownBy(() -> sources.getForPost(id)).isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo("SOURCE_DELETION_PENDING"));
                status.setRollbackOnly();
            });
            release.countDown();
            worker.get().get(10, TimeUnit.SECONDS);
            assertThat(repository.existsById(id)).isFalse();
        } finally {
            stop(executor, release);
        }
    }

    @Test
    void rolledBackPostRemovalDoesNotDeleteItsSourceOrRemoteFile() {
        UUID id = upload();
        String key = repository.findById(id).orElseThrow().getStorageKey();
        PostResponse original = posts.create(input(id, null));
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            posts.delete(original.id());
            assertThat(storage.load(key)).isNotNull();
            status.setRollbackOnly();
        });
        assertThat(posts.get(original.id()).markdownSource().id()).isEqualTo(id);
        assertThat(repository.countUsages(id)).isEqualTo(1);
        assertThat(storage.load(key)).isNotNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"create", "update", "duplicate"})
    void everyReferenceWriterRejectsAPendingSource(String writer) {
        UUID id = upload();
        PostResponse original = posts.create(input(id, null));
        // Inject pending state to verify the defensive contract on all three writers.
        jdbc.update("UPDATE markdown_sources SET deletion_pending = true WHERE id = ?", id);
        assertThatThrownBy(() -> {
            switch (writer) {
                case "create" -> posts.create(input(id, null));
                case "update" -> posts.update(original.id(), input(id, original.version()));
                case "duplicate" -> posts.duplicate(original.id());
                default -> throw new AssertionError(writer);
            }
        }).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.getErrorCode()).isEqualTo("SOURCE_DELETION_PENDING"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM posts", Long.class)).isEqualTo(1);
        assertThat(repository.countUsages(id)).isEqualTo(1);
    }

    @Test
    void oppositeReplacementsUseAConsistentLockOrder() throws Exception {
        UUID first = upload();
        UUID second = upload();
        PostResponse a = posts.create(input(first, null));
        PostResponse b = posts.create(input(second, null));
        // Keep each source alive while the first swap commits before the second.
        posts.create(input(first, null));
        posts.create(input(second, null));
        var start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var swapA = executor.submit(() -> { await(start); return posts.update(a.id(), input(second, a.version())); });
            var swapB = executor.submit(() -> { await(start); return posts.update(b.id(), input(first, b.version())); });
            start.countDown();
            assertThat(swapA.get(10, TimeUnit.SECONDS).markdownSource().id()).isEqualTo(second);
            assertThat(swapB.get(10, TimeUnit.SECONDS).markdownSource().id()).isEqualTo(first);
            assertThat(repository.countUsages(first)).isEqualTo(2);
            assertThat(repository.countUsages(second)).isEqualTo(2);
        } finally {
            stop(executor, start);
        }
    }
}
