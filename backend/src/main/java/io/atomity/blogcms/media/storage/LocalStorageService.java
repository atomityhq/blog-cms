
package io.atomity.blogcms.media.storage;

import io.atomity.blogcms.shared.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Profile("local-storage")
@Service
public class LocalStorageService implements StorageService {

    private final Path root;

    public LocalStorageService(
            @Value("${blogcms.media.local.directory:/app/uploads}") String directory) {
        this.root = Path.of(directory).toAbsolutePath().normalize();
    }

    @Override
    public void store(String key, byte[] content) {
        Path target = resolve(key);

        try {
            Files.createDirectories(target.getParent());

            Path temporary = Files.createTempFile(
                    target.getParent(), ".upload-", ".tmp");

            try {
                Files.write(temporary, content);

                try {
                    Files.move(
                            temporary,
                            target,
                            StandardCopyOption.ATOMIC_MOVE);
                } catch (IOException atomicMoveFailure) {
                    Files.move(
                            temporary,
                            target,
                            StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(temporary);
            }
        } catch (IOException ex) {
            throw unavailable();
        }
    }

    @Override
    public Resource load(String key) {
        Path file = resolve(key);

        if (!Files.isRegularFile(file)) {
            throw ApiException.notFound("Image");
        }

        return new FileSystemResource(file);
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException ex) {
            throw unavailable();
        }
    }

    private Path resolve(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Storage key cannot be blank");
        }

        Path relative = Path.of(key);

        if (relative.isAbsolute()) {
            throw new IllegalArgumentException("Storage key must be relative");
        }

        Path resolved = root.resolve(relative).normalize();

        if (!resolved.startsWith(root) || resolved.equals(root)) {
            throw new IllegalArgumentException("Invalid storage key");
        }

        return resolved;
    }

    private ApiException unavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "MEDIA_STORAGE_UNAVAILABLE",
                "Media storage is temporarily unavailable");
    }
}

