package io.atomity.blogcms.post;

import io.atomity.blogcms.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Post search ORs ILIKE '%term%' over title, excerpt, slug and body text
 * ({@code PostSpecifications.matches}). PostgreSQL can only answer an OR from indexes when
 * every column in it has one; otherwise it reads the whole posts table on every search.
 * With sequential scans priced out, the query plan shows whether the indexes can be used.
 */
class PostSearchIndexTest extends IntegrationTest {

    /** The predicate PostSpecifications.matches builds; keep the columns in step with it. */
    private static final String SEARCH = """
            EXPLAIN SELECT count(*) FROM posts p
            WHERE p.title ILIKE '%term%' ESCAPE '\\' OR p.excerpt ILIKE '%term%' ESCAPE '\\'
               OR p.slug ILIKE '%term%' ESCAPE '\\' OR p.content_text ILIKE '%term%' ESCAPE '\\'
            """;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void searchUsesTheTrigramIndexesInsteadOfReadingEveryPost() {
        String plan = jdbcTemplate.execute((ConnectionCallback<String>) connection -> {
            try (Statement statement = connection.createStatement()) {
                statement.execute("SET enable_seqscan = off");
                try (ResultSet rows = statement.executeQuery(SEARCH)) {
                    StringBuilder text = new StringBuilder();
                    while (rows.next()) {
                        text.append(rows.getString(1)).append('\n');
                    }
                    return text.toString();
                } finally {
                    // The connection goes back to the pool shared by every other test.
                    statement.execute("RESET enable_seqscan");
                }
            }
        });

        assertThat(plan)
                .doesNotContain("Seq Scan")
                .contains("idx_posts_title_trgm", "idx_posts_excerpt_trgm",
                        "idx_posts_slug_trgm", "idx_posts_content_text_trgm");
    }
}
