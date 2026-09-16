/** The two Modrinth `project_type` facets this app lets users browse. */
export type ModrinthProjectTypeFilter = "plugin" | "mod";

/** A single hit from Modrinth's `/v2/search` endpoint (subset of fields we use). */
export interface ModrinthSearchHit {
  project_id: string;
  project_type: string;
  slug: string;
  author: string;
  title: string;
  description: string;
  /** Loader + tag facets, e.g. "paper", "fabric", "economy". */
  categories: string[];
  versions: string[];
  downloads: number;
  follows: number;
  icon_url: string | null;
  license: string;
  latest_version: string | null;
  date_modified: string;
  color: number | null;
}

export interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}
