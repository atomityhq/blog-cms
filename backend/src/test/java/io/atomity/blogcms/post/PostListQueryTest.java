package io.atomity.blogcms.post;

import io.atomity.blogcms.post.dto.PostListQuery;
import io.atomity.blogcms.shared.ApiException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PostListQueryTest {

    @Test
    void allowsPageAtMaximumOffset() {
        PostListQuery query = new PostListQuery(null, null, null, null, null, null, 100, 100);

        assertThat(query.toPageable().getOffset()).isEqualTo(10_000);
    }

    @Test
    void rejectsPagesBeyondMaximumOffset() {
        PostListQuery query = new PostListQuery(null, null, null, null, null, null, 101, 100);

        assertThatThrownBy(query::toPageable)
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("maximum offset");
    }

    @Test
    void negativePageNumberDefaultsToFirstPage() {
        PostListQuery query = new PostListQuery(null, null, null, null, null, null, -1, null);

        assertThat(query.toPageable().getPageNumber()).isZero();
    }

    @Test
    void rejectsMultipleOrCommaSeparatedSortFields() {
        PostListQuery repeated = new PostListQuery(null, null, null, null,
                List.of("title", "wordCount"), null, null, null);
        PostListQuery commaSeparated = new PostListQuery(null, null, null, null,
                List.of("title,asc"), null, null, null);

        assertThatThrownBy(repeated::toPageable)
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("sort must contain one field");
        assertThatThrownBy(commaSeparated::toPageable)
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("sort must contain one field");
    }
}
