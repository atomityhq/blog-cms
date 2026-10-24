package io.atomity.blogcms.markdown.service;

import io.atomity.blogcms.markdown.repository.MarkdownSourceRepository;
import io.atomity.blogcms.media.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MarkdownSourceServiceTest {

    private static final byte[] VALID_MARKDOWN = "# Hello World\n".getBytes(StandardCharsets.UTF_8);

    @Test
    void uploadRunsStorageOutsideDatabaseTransaction() {
        MarkdownSourceRepository repository = mock(MarkdownSourceRepository.class);
        StorageService storage = mock(StorageService.class);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        TransactionStatus transactionStatus = mock(TransactionStatus.class);

        when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        MarkdownSourceService service = new MarkdownSourceService(repository, storage, transactionManager);
        var file = new MockMultipartFile("file", "test.md", "text/markdown", VALID_MARKDOWN);

        service.upload(file);

        InOrder inOrder = inOrder(storage, transactionManager);
        inOrder.verify(storage).store(any(), any());
        inOrder.verify(transactionManager).getTransaction(any());
        inOrder.verify(transactionManager).commit(transactionStatus);
    }

    @Test
    void uploadKeepsDatabaseExceptionWhenStorageCleanupFails() {
        MarkdownSourceRepository repository = mock(MarkdownSourceRepository.class);
        StorageService storage = mock(StorageService.class);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        TransactionStatus transactionStatus = mock(TransactionStatus.class);

        when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);
        RuntimeException databaseFailure = new RuntimeException("database write failed");
        when(repository.save(any())).thenThrow(databaseFailure);
        RuntimeException cleanupFailure = new RuntimeException("cleanup failed");
        doThrow(cleanupFailure).when(storage).delete(any());

        MarkdownSourceService service = new MarkdownSourceService(repository, storage, transactionManager);
        var file = new MockMultipartFile("file", "test.md", "text/markdown", VALID_MARKDOWN);

        RuntimeException thrown = assertThrows(RuntimeException.class, () -> service.upload(file));

        assertSame(databaseFailure, thrown);
        assertEquals(1, thrown.getSuppressed().length);
        assertSame(cleanupFailure, thrown.getSuppressed()[0]);
        verify(storage).delete(any());
    }

    @Test
    void uploadCleansUpStoredFileWhenDatabaseWriteThrowsError() {
        MarkdownSourceRepository repository = mock(MarkdownSourceRepository.class);
        StorageService storage = mock(StorageService.class);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        TransactionStatus transactionStatus = mock(TransactionStatus.class);

        when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);

        AssertionError databaseFailure = new AssertionError("database write failed");
        when(repository.save(any())).thenThrow(databaseFailure);

        MarkdownSourceService service = new MarkdownSourceService(repository, storage, transactionManager);
        var file = new MockMultipartFile("file", "test.md", "text/markdown", VALID_MARKDOWN);

        AssertionError thrown = assertThrows(AssertionError.class, () -> service.upload(file));

        assertSame(databaseFailure, thrown);
        verify(storage).store(any(), any());
        verify(storage).delete(any());
    }
}
