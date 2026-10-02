package io.atomity.blogcrm.media.storage;

import org.springframework.core.io.Resource;

/**
 * Where uploaded files live. The local-disk implementation is the default; an
 * S3-compatible one can be added behind this interface without touching callers.
 */
public interface StorageService {

    /** Stores the bytes under {@code key} (a relative path such as {@code 2026/10/<uuid>.png}). */
    void store(String key, byte[] content);

    /** The stored file, or throws if it is missing. */
    Resource load(String key);

    /** Removes the file; a missing file is not an error. */
    void delete(String key);
}
