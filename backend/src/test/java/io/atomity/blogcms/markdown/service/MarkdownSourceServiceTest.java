package io.atomity.blogcms.markdown.service;

import io.atomity.blogcms.markdown.entity.MarkdownSource;
import io.atomity.blogcms.markdown.repository.MarkdownSourceRepository;
import io.atomity.blogcms.media.storage.StorageService;
import io.atomity.blogcms.shared.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MarkdownSourceServiceTest {
    private final MarkdownSourceRepository repository = mock(MarkdownSourceRepository.class);
    private final StorageService storage = mock(StorageService.class);
    private final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    private final jakarta.persistence.EntityManager entityManager = mock(jakarta.persistence.EntityManager.class);
    private final MarkdownSourceService service = new MarkdownSourceService(repository, storage, manager, entityManager);
    private final MarkdownSource source = MarkdownSource.create(UUID.randomUUID(), "markdown/test.md", "test.md", 6);

    @BeforeEach
    void setUp() {
        when(manager.getTransaction(any())).thenAnswer(invocation -> new SimpleTransactionStatus());
        when(repository.findForUpdate(source.getId())).thenReturn(Optional.of(source));
    }

    @Test
    void deletionCommitsItsReservationBeforeContactingStorage() {
        service.delete(source.getId());

        assertThat(source.isDeletionPending()).isTrue();
        var order = inOrder(repository, manager, storage);
        order.verify(repository).findForUpdate(source.getId());
        order.verify(repository).countUsages(source.getId());
        order.verify(manager).commit(any());
        order.verify(storage).deleteRequired(source.getStorageKey());
        order.verify(repository).deleteById(source.getId());
        order.verify(manager).commit(any());
    }

    @Test
    void linkedSourceCannotBeDeleted() {
        when(repository.countUsages(source.getId())).thenReturn(2L);
        assertThatThrownBy(() -> service.delete(source.getId()))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getErrorCode()).isEqualTo("SOURCE_IN_USE"));
        assertThat(source.isDeletionPending()).isFalse();
        verifyNoInteractions(storage);
        verify(repository, never()).deleteById(any());
    }

    @Test
    void storageFailureKeepsPendingSourceAndRetryCompletesDeletion() {
        ApiException unavailable = new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MEDIA_STORAGE_UNAVAILABLE", "Try again");
        doThrow(unavailable).doNothing().when(storage).deleteRequired(source.getStorageKey());

        assertThatThrownBy(() -> service.delete(source.getId())).isSameAs(unavailable);
        assertThat(source.isDeletionPending()).isTrue();
        verify(repository, never()).deleteById(any());

        service.delete(source.getId());
        verify(storage, times(2)).deleteRequired(source.getStorageKey());
        verify(repository).deleteById(source.getId());
    }

    @Test
    void databaseFailureAfterRemoteDeleteCanBeRetried() {
        doThrow(new IllegalStateException("database unavailable")).doNothing()
                .when(repository).deleteById(source.getId());
        assertThatThrownBy(() -> service.delete(source.getId())).hasMessage("database unavailable");
        assertThat(source.isDeletionPending()).isTrue();
        service.delete(source.getId());
        verify(storage, times(2)).deleteRequired(source.getStorageKey());
    }

    @Test
    void missingSourceDoesNotContactStorage() {
        when(repository.findForUpdate(source.getId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.delete(source.getId()))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(storage);
    }

    @Test
    void pendingSourceCannotBeAttachedOrDownloaded() {
        source.markDeletionPending();
        when(repository.findById(source.getId())).thenReturn(Optional.of(source));
        assertThatThrownBy(() -> service.getForPost(source.getId()))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo("SOURCE_DELETION_PENDING"));
        assertThatThrownBy(() -> service.get(source.getId()))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void uploadContactsStorageBeforeStartingDatabaseTransaction() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var uploaded = service.upload(file());
        assertThat(uploaded.fileName()).isEqualTo("test.md");
        var order = inOrder(storage, manager, repository);
        order.verify(storage).store(anyString(), any());
        order.verify(manager).getTransaction(any());
        order.verify(repository).save(any());
        order.verify(manager).commit(any());
    }

    @Test
    void databaseCommitFailureCleansUpUploadAndPreservesCleanupFailure() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        RuntimeException databaseFailure = new RuntimeException("commit failed");
        RuntimeException cleanupFailure = new RuntimeException("cleanup failed");
        doThrow(databaseFailure).when(manager).commit(any());
        doThrow(cleanupFailure).when(storage).deleteRequired(anyString());

        assertThatThrownBy(() -> service.upload(file())).isSameAs(databaseFailure)
                .satisfies(ex -> assertThat(ex.getSuppressed()).containsExactly(cleanupFailure));
    }

    @Test
    void uploadStorageFailureDoesNotWriteMetadata() {
        doThrow(new IllegalStateException("upload failed")).when(storage).store(anyString(), any());
        assertThatThrownBy(() -> service.upload(file())).hasMessage("upload failed");
        verify(repository, never()).save(any());
        verifyNoInteractions(manager);
    }

    @Test
    void attachmentRefreshesTheEntityAfterAcquiringItsLock() {
        service.getForPost(source.getId());
        var order = inOrder(repository, entityManager);
        order.verify(repository).findForUpdate(source.getId());
        order.verify(entityManager).refresh(source);
    }

    @Test
    void replacementLocksDistinctSourceIdsInStableOrder() {
        UUID first = new UUID(0, 1);
        UUID second = new UUID(0, 2);
        service.lockForPostChange(second, first);
        var order = inOrder(repository);
        order.verify(repository).findForUpdate(first);
        order.verify(repository).findForUpdate(second);
        reset(repository);
        service.lockForPostChange(first, first);
        verify(repository, times(1)).findForUpdate(first);
    }

    @Test
    void automaticCleanupLocksBeforeCheckingReferences() {
        when(repository.countUsages(source.getId())).thenReturn(1L);
        service.deleteIfUnused(source);
        var order = inOrder(repository, entityManager);
        order.verify(repository).findForUpdate(source.getId());
        order.verify(entityManager).refresh(source);
        order.verify(repository).countUsages(source.getId());
        verify(repository, never()).delete(any());
        verifyNoInteractions(storage);
    }

    @Test
    void automaticCleanupOfAnAlreadyDeletedSourceIsHarmless() {
        when(repository.findForUpdate(source.getId())).thenReturn(Optional.empty());
        service.deleteIfUnused(source);
        verify(repository, never()).countUsages(any());
        verify(repository, never()).delete(any());
    }

    @Test
    void automaticCleanupOnlyTouchesStorageAfterCommitAndDoesNotFailASavedPost() {
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.deleteIfUnused(source);
            verifyNoInteractions(storage);
            var callbacks = org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations();
            doThrow(new RuntimeException("remote unavailable")).when(storage).delete(source.getStorageKey());
            assertThatCode(() -> callbacks.forEach(callback -> callback.afterCommit())).doesNotThrowAnyException();
            verify(storage).delete(source.getStorageKey());
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private static MockMultipartFile file() {
        return new MockMultipartFile("file", "test.md", "text/markdown", "# Test".getBytes(StandardCharsets.UTF_8));
    }
}
