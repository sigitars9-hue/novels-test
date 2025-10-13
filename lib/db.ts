export type Profile = {
  id: string;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  is_admin: boolean;
};

export type Novel = {
  id: string;
  slug: string;
  title: string;
  author_id: string;
  cover_url: string | null;
  synopsis: string | null;
  tags: string[] | null;
  status: "Ongoing" | "Completed";
  rating: number | null;
  created_at: string;
};

export type Chapter = {
  id: string;
  novel_id: string;
  number: number;
  title: string;
  content: string | null;
  updated_at: string;
};

export type Submission = {
  id: string;
  author_id: string;
  title: string;
  synopsis: string | null;
  tags: string[] | null;
  cover_url: string | null;
  content: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};
