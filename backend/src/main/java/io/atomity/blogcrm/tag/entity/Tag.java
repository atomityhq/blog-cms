package io.atomity.blogcrm.tag.entity;

import io.atomity.blogcrm.shared.Timestamps;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tags")
public class Tag {

    @Id
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Tag() {
    }

    public static Tag create(String name, String slug) {
        var tag = new Tag();
        tag.id = UUID.randomUUID();
        tag.createdAt = Timestamps.now();
        tag.rename(name, slug);
        return tag;
    }

    public void rename(String name, String slug) {
        this.name = name.strip();
        this.slug = slug;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public Instant getCreatedAt() { return createdAt; }
}
