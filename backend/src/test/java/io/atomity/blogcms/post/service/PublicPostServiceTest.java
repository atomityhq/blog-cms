package io.atomity.blogcms.post.service;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;

class PublicPostServiceTest {

    @Test
    void defaultsToFirstPageOfTen() {
        Pageable pageable = PublicPostService.pageable(null, null);
        assertThat(pageable.getPageNumber()).isZero();
        assertThat(pageable.getPageSize()).isEqualTo(10);
    }

    @Test
    void clampsOutOfRangeValues() {
        assertThat(PublicPostService.pageable(-1, 0).getPageNumber()).isZero();
        assertThat(PublicPostService.pageable(-1, 0).getPageSize()).isEqualTo(1);
        assertThat(PublicPostService.pageable(3, 500).getPageNumber()).isEqualTo(3);
        assertThat(PublicPostService.pageable(3, 500).getPageSize()).isEqualTo(100);
    }

    @Test
    void sortsNewestPublishedFirstWithIdTieBreak() {
        Sort sort = PublicPostService.pageable(null, null).getSort();
        assertThat(sort.getOrderFor("publishedAt").getDirection()).isEqualTo(Sort.Direction.DESC);
        assertThat(sort.getOrderFor("id").getDirection()).isEqualTo(Sort.Direction.ASC);
        assertThat(sort.toList()).extracting(Sort.Order::getProperty).containsExactly("publishedAt", "id");
    }
}
