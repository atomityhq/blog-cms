package io.atomity.blogcms.author.entity;

import io.atomity.blogcms.media.entity.Media;
import io.atomity.blogcms.shared.Timestamps;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "authors")
public class Author {

    @Id
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "slug", nullable = false, unique = true)
    private String slug;

    @Column(name = "bio", nullable = false)
    private String bio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "avatar_id")
    private Media avatar;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Author() {
    }

    public static Author create(String name, String slug, String bio, Media avatar) {
        var author = new Author();
        author.id = UUID.randomUUID();
        author.createdAt = Timestamps.now();
        author.update(name, slug, bio, avatar);
        return author;
    }

    public void update(String name, String slug, String bio, Media avatar) {
        this.name = name.strip();
        this.slug = slug;
        this.bio = bio == null ? "" : bio.strip();
        this.avatar = avatar;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public String getBio() { return bio; }
    public Media getAvatar() { return avatar; }
    public Instant getCreatedAt() { return createdAt; }
}
