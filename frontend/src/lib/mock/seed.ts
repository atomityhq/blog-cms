import type { ContentDoc, ContentNode } from "@/types/content";
import type { PostStatus } from "@/types/post";
import type { AuthorRecord, MediaRecord, MockDb, PostRecord, TagRecord } from "./db";
import { placeholderImage } from "./placeholder";

/*
 * Sample data for the mockup. Timestamps are relative to the moment the seed is
 * created, so the "updated 3h ago" style labels look realistic on first load.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

// ── Tiny document builders ──────────────────────────────────────────────

const text = (value: string): ContentNode => ({ type: "text", text: value });
const p = (value: string): ContentNode => ({ type: "paragraph", content: [text(value)] });
const h = (level: 2 | 3, value: string): ContentNode => ({ type: "heading", attrs: { level }, content: [text(value)] });
const ul = (items: string[]): ContentNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});
const quote = (value: string): ContentNode => ({ type: "blockquote", content: [p(value)] });
const doc = (...content: ContentNode[]): ContentDoc => ({ type: "doc", content });

// ── Media ───────────────────────────────────────────────────────────────

const MEDIA_SEED: [id: string, label: string, from: string, to: string, filename: string][] = [
  ["m-0001", "Cloud cost", "#97ddb1", "#ddf5e6", "cloud-cost-hero.svg"],
  ["m-0002", "EU Data Act", "#e8e5d9", "#b0ecc6", "eu-data-act.svg"],
  ["m-0003", "Kubernetes", "#b0ecc6", "#f6f4ec", "kubernetes-rightsizing.svg"],
  ["m-0004", "FinOps", "#ffd7b0", "#f6f4ec", "finops-team.svg"],
  ["m-0005", "Carbon", "#c9e7d3", "#e8e5d9", "carbon-footprint.svg"],
  ["m-0006", "Multi-cloud", "#ddf5e6", "#ffd7b0", "multi-cloud.svg"],
];

function seedMedia(): MediaRecord[] {
  return MEDIA_SEED.map(([id, label, from, to, filename], i) => {
    const url = placeholderImage(label, from, to);
    return {
      id,
      url,
      originalFilename: filename,
      contentType: "image/svg+xml",
      sizeBytes: url.length,
      width: 1200,
      height: 630,
      altText: `${label} illustration`,
      createdAt: ago((30 - i) * DAY),
    };
  });
}

// ── Authors & tags ──────────────────────────────────────────────────────

function seedAuthors(): AuthorRecord[] {
  return [
    {
      id: "a-0001",
      name: "Atomity Team",
      slug: "atomity-team",
      bio: "Posts written together by the people building Atomity.",
      avatarId: null,
      createdAt: ago(60 * DAY),
    },
    {
      id: "a-0002",
      name: "Lena Hoffmann",
      slug: "lena-hoffmann",
      bio: "Cloud architect. Writes about FinOps, Kubernetes and cost-aware design.",
      avatarId: null,
      createdAt: ago(55 * DAY),
    },
    {
      id: "a-0003",
      name: "Rahul Mehta",
      slug: "rahul-mehta",
      bio: "Platform engineer focused on multi-cloud tooling.",
      avatarId: null,
      createdAt: ago(40 * DAY),
    },
    {
      id: "a-0004",
      name: "Sofia Romano",
      slug: "sofia-romano",
      bio: "Policy analyst covering EU cloud and data regulation.",
      avatarId: null,
      createdAt: ago(20 * DAY),
    },
  ];
}

const TAG_NAMES: [id: string, name: string][] = [
  ["t-0001", "FinOps"],
  ["t-0002", "Kubernetes"],
  ["t-0003", "AWS"],
  ["t-0004", "GCP"],
  ["t-0005", "Regulation"],
  ["t-0006", "Sustainability"],
  ["t-0007", "Engineering"],
  ["t-0008", "Product updates"],
];

function seedTags(): TagRecord[] {
  return TAG_NAMES.map(([id, name], i) => ({
    id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    createdAt: ago((50 - i) * DAY),
  }));
}

// ── Posts ───────────────────────────────────────────────────────────────

interface PostSeed {
  title: string;
  excerpt: string;
  status: PostStatus;
  authors: string[];
  tags: string[];
  cover: string | null;
  updated: number;
  published?: number;
  featured?: boolean;
  focusKeyword?: string;
  body: ContentDoc;
}

const POSTS: PostSeed[] = [
  {
    title: "The EU Data Act and switching charges: what changes for cloud exits in 2027",
    excerpt:
      "From January 2027, cloud providers can no longer charge you to leave. Here is what the EU Data Act's switching rules mean for your exit plan.",
    status: "PUBLISHED",
    authors: ["a-0004"],
    tags: ["t-0005", "t-0003", "t-0004"],
    cover: "m-0002",
    updated: 2 * DAY,
    published: 9 * DAY,
    featured: true,
    focusKeyword: "EU Data Act switching charges",
    body: doc(
      p("The EU Data Act removes one of the biggest hidden costs of changing cloud providers: switching charges."),
      h(2, "What the regulation says"),
      p("Providers must let customers switch with a maximum two-month notice period and must phase out egress and switching fees by 12 January 2027."),
      ul([
        "Until 2027, providers may only charge the actual cost of switching.",
        "After 2027, switching charges are prohibited entirely.",
        "Contracts must describe exportable data and the exit process.",
      ]),
      h(2, "What to do now"),
      p("Map your data gravity, review contract exit clauses, and build a cost baseline you can compare across providers."),
      quote("Portability only helps if you know what you are running and what it costs."),
    ),
  },
  {
    title: "Rightsizing Kubernetes workloads without breaking SLOs",
    excerpt: "Requests and limits drift. A practical loop for rightsizing pods using real utilisation data — and the guardrails that keep latency flat.",
    status: "PUBLISHED",
    authors: ["a-0002"],
    tags: ["t-0002", "t-0001", "t-0007"],
    cover: "m-0003",
    updated: 5 * DAY,
    published: 14 * DAY,
    focusKeyword: "Kubernetes rightsizing",
    body: doc(
      p("Most clusters run at 20–35% of requested CPU. The gap is money spent on headroom nobody uses."),
      h(2, "Measure before you cut"),
      p("Use the p95 of CPU and the max of memory over at least two weeks, and exclude deploy spikes."),
      h(2, "Guardrails"),
      ul(["Never cut memory below observed max.", "Roll out per namespace.", "Watch latency SLOs for 48 hours after each change."]),
    ),
  },
  {
    title: "FinOps for small teams: a 30-day starter plan",
    excerpt: "You don't need a FinOps department to stop overspending. A four-week plan for teams of five to fifty engineers.",
    status: "PUBLISHED",
    authors: ["a-0001", "a-0002"],
    tags: ["t-0001"],
    cover: "m-0004",
    updated: 12 * DAY,
    published: 20 * DAY,
    focusKeyword: "FinOps starter plan",
    body: doc(
      h(2, "Week 1: visibility"),
      p("Turn on cost allocation tags and export billing data somewhere you can query it."),
      h(2, "Week 2: ownership"),
      p("Every resource gets an owner. Untagged spend becomes a weekly agenda item."),
      h(2, "Weeks 3–4: quick wins"),
      ul(["Delete unattached volumes and old snapshots.", "Schedule non-production environments.", "Buy commitments only for steady baseline usage."]),
    ),
  },
  {
    title: "Measuring the carbon footprint of your cloud estate",
    excerpt: "Cost and carbon follow the same curve. How to estimate emissions per workload and where the data falls short.",
    status: "DRAFT",
    authors: ["a-0002", "a-0004"],
    tags: ["t-0006", "t-0001"],
    cover: "m-0005",
    updated: 3 * HOUR,
    focusKeyword: "cloud carbon footprint",
    body: doc(
      p("Every provider now publishes a carbon tool, and none of them agree."),
      h(2, "Location matters more than size"),
      p("The same workload can emit five times more depending on the region's grid mix."),
    ),
  },
  {
    title: "Multi-cloud cost allocation with a single tagging strategy",
    excerpt: "AWS tags, GCP labels, Azure tags — one schema that works across all three, and how to enforce it.",
    status: "DRAFT",
    authors: ["a-0003"],
    tags: ["t-0003", "t-0004", "t-0001"],
    cover: "m-0006",
    updated: 26 * HOUR,
    body: doc(p("A tagging strategy is only as good as its enforcement."), h(2, "The schema"), ul(["owner", "team", "environment", "cost-center"])),
  },
  {
    title: "Introducing workload recommendations in Atomity",
    excerpt: "Atomity now suggests rightsizing, scheduling and commitment changes per workload — with the savings and risk spelled out.",
    status: "PUBLISHED",
    authors: ["a-0001"],
    tags: ["t-0008"],
    cover: "m-0001",
    updated: 25 * DAY,
    published: 25 * DAY,
    body: doc(p("Today we're launching workload recommendations."), h(2, "What's included"), ul(["Rightsizing", "Scheduling", "Commitment coverage"])),
  },
  {
    title: "Spot instances in production: when it's worth the risk",
    excerpt: "Spot capacity can cut compute bills by 70%. A decision framework for which workloads belong there.",
    status: "DRAFT",
    authors: ["a-0003"],
    tags: ["t-0003", "t-0007"],
    cover: null,
    updated: 4 * DAY,
    body: doc(p("Interruptions are a feature you design for, not a bug you avoid.")),
  },
  {
    title: "GCP committed use discounts explained",
    excerpt: "Resource-based vs spend-based CUDs, how they stack with sustained use discounts, and how to size them.",
    status: "PUBLISHED",
    authors: ["a-0003"],
    tags: ["t-0004", "t-0001"],
    cover: null,
    updated: 30 * DAY,
    published: 32 * DAY,
    body: doc(p("Committed use discounts trade flexibility for price."), h(2, "Two flavours"), ul(["Resource-based", "Spend-based"])),
  },
  {
    title: "Why your S3 bill keeps growing",
    excerpt: "Versioning, incomplete multipart uploads and the wrong storage class. Five places storage spend hides.",
    status: "PUBLISHED",
    authors: ["a-0002"],
    tags: ["t-0003"],
    cover: null,
    updated: 40 * DAY,
    published: 41 * DAY,
    body: doc(p("Storage is cheap per gigabyte and expensive in aggregate.")),
  },
  {
    title: "2025 cloud pricing changes roundup",
    excerpt: "Every price change from AWS, GCP and Azure in 2025 that affected real bills.",
    status: "ARCHIVED",
    authors: ["a-0001"],
    tags: ["t-0003", "t-0004"],
    cover: null,
    updated: 60 * DAY,
    published: 200 * DAY,
    body: doc(p("This roundup is kept for reference; see the 2026 edition for current prices.")),
  },
  {
    title: "Kubernetes cost visibility with namespaces and labels",
    excerpt: "Splitting a shared cluster bill fairly between teams.",
    status: "DRAFT",
    authors: ["a-0002", "a-0003"],
    tags: ["t-0002", "t-0001"],
    cover: null,
    updated: 7 * DAY,
    body: doc(p("Shared clusters need a shared definition of fair.")),
  },
  {
    title: "Untitled draft",
    excerpt: "",
    status: "DRAFT",
    authors: [],
    tags: [],
    cover: null,
    updated: 9 * DAY,
    body: doc({ type: "paragraph" }),
  },
  {
    title: "What the NIS2 directive means for cloud operations",
    excerpt: "Incident reporting timelines, supply-chain duties and what they mean for your cloud setup.",
    status: "PUBLISHED",
    authors: ["a-0004"],
    tags: ["t-0005"],
    cover: null,
    updated: 15 * DAY,
    published: 16 * DAY,
    body: doc(p("NIS2 widens the set of companies that count as essential."), h(2, "Reporting"), p("An early warning within 24 hours.")),
  },
  {
    title: "Launch week recap",
    excerpt: "Five days, five releases. Everything we shipped during launch week.",
    status: "ARCHIVED",
    authors: ["a-0001"],
    tags: ["t-0008"],
    cover: null,
    updated: 90 * DAY,
    published: 120 * DAY,
    body: doc(p("Thanks to everyone who joined us for launch week.")),
  },
];

function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

function seedPosts(): PostRecord[] {
  return POSTS.map((post, i) => ({
    id: `p-${String(i + 1).padStart(4, "0")}`,
    title: post.title,
    slug: slugOf(post.title) || `untitled-${i + 1}`,
    excerpt: post.excerpt,
    content: post.body,
    status: post.status,
    featured: post.featured ?? false,
    coverImageId: post.cover,
    coverImageAlt: "",
    seoTitle: "",
    metaDescription: post.status === "PUBLISHED" ? post.excerpt.slice(0, 160) : "",
    focusKeyword: post.focusKeyword ?? "",
    canonicalUrl: "",
    authorIds: post.authors,
    tagIds: post.tags,
    publishedAt: post.published !== undefined ? ago(post.published) : null,
    createdAt: ago(Math.max(post.updated, post.published ?? 0) + 2 * DAY),
    updatedAt: ago(post.updated),
    version: 1,
  }));
}

export function createSeed(): MockDb {
  return {
    posts: seedPosts(),
    authors: seedAuthors(),
    tags: seedTags(),
    media: seedMedia(),
  };
}
